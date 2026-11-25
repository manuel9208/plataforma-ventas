import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/servicios.repository.js';
import * as extrasRepo from '../repositories/extras.repository.js';
import * as skuRepo from '../repositories/sku.repository.js';
import * as historial from '../repositories/historialPrecios.repository.js';
import * as catalogoRepo from '../repositories/catalogo.repository.js';
import { contarSucursalesActivas, listarSucursalesPorIds } from '../repositories/usuarios.repository.js';
import * as ser from '../serializers/servicios.serializer.js';
import * as catalogoSer from '../serializers/catalogo.serializer.js';

const quien = (actor) => ({ usuarioId: actor.id, adminGlobalId: actor.adminGlobalId });

// El contacto del taller externo solo lo ven el adminglobal, el administrador (1) y el gerente (2)
const NIVEL_VER_CONTACTO = 2;
const puedeVerContacto = (actor) => actor.esGlobal === true || (actor.nivel != null && actor.nivel <= NIVEL_VER_CONTACTO);

function exigirContacto(actor, n) {
  if (n.contactoCotizacion !== undefined && !puedeVerContacto(actor)) {
    throw new ErrorHttp(403, 'No tienes permiso para el contacto de cotización');
  }
}

// Un servicio que se cotiza lleva precio $0: el precio real se pone al cotizar la nota
const paraCotizar = (n) => ({ ...n, precios: n.precios.map((p) => ({ ...p, precio: 0 })), preciosSucursal: {} });

// Quita repetidos y completa lo que no vino
function normalizar(datos) {
  return {
    ...datos,
    sucursalIds: datos.sucursalIds ? [...new Set(datos.sucursalIds)] : undefined,
    preciosSucursal: datos.preciosSucursal ?? {},
    extraIds: [...new Set(datos.extraIds ?? [])],
  };
}

function validarPayload(actor, d) {
  const tipoIds = d.precios.map((p) => p.tipoArticuloId);
  if (new Set(tipoIds).size !== tipoIds.length) throw new ErrorHttp(400, 'Hay un tipo de artículo repetido');

  if (!d.sucursalIds.every((id) => actor.sucursales.includes(id))) {
    throw new ErrorHttp(403, 'No tienes acceso a una de las sucursales');
  }
  for (const [sid, porTipo] of Object.entries(d.preciosSucursal)) {
    if (!d.sucursalIds.includes(Number(sid))) {
      throw new ErrorHttp(400, 'Hay un precio para una sucursal que no está seleccionada');
    }
    for (const tid of Object.keys(porTipo)) {
      if (!tipoIds.includes(Number(tid))) {
        throw new ErrorHttp(400, 'Hay un precio de sucursal para un tipo de artículo sin precio general');
      }
    }
  }
}

async function validarReferencias(db, actor, { departamentoId, tasaIvaId, sucursalIds, tipoIds, extraIds }) {
  const e = actor.empresaId;
  if (departamentoId !== undefined) {
    const d = await catalogoRepo.obtener(db, e, 'departamentos', departamentoId);
    if (!d?.activo) throw new ErrorHttp(400, 'Elige un departamento activo');
  }
  if (tasaIvaId !== undefined) {
    const t = await catalogoRepo.obtener(db, e, 'tasasIva', tasaIvaId);
    if (!t?.activo) throw new ErrorHttp(400, 'Elige una tasa de IVA activa');
  }
  if (sucursalIds && (await contarSucursalesActivas(db, e, sucursalIds)) !== sucursalIds.length) {
    throw new ErrorHttp(400, 'Sucursal inválida');
  }
  if (tipoIds && (await repo.contarTiposActivos(db, e, tipoIds)) !== tipoIds.length) {
    throw new ErrorHttp(400, 'Elige tipos de artículo activos');
  }
  if (extraIds?.length && (await extrasRepo.contarActivos(db, e, extraIds)) !== extraIds.length) {
    throw new ErrorHttp(400, 'Uno de los extras ya no está disponible');
  }
}

async function cargarDetalle(db, actor, id) {
  const e = actor.empresaId;
  const fila = await repo.obtener(db, e, actor.sucursales, id);
  if (!fila) return null;
  const [precios, sucursales, preciosSucursal, extras] = await Promise.all([
    repo.listarPrecios(db, e, id),
    repo.listarSucursales(db, e, id, actor.sucursales),
    repo.listarPreciosSucursal(db, e, id, actor.sucursales),
    repo.listarExtraIds(db, e, id),
  ]);
  return { ...fila, precios, sucursales, preciosSucursal, extras };
}

const bitacora = (db, actor, accion, id, sucursalId, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    sucursalId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'servicio',
    entidadId: id,
    antes,
    despues,
    ip,
  });

// Guarda precios, sucursales, precios propios y extras, y deja el historial
async function sincronizar(db, actor, servicioId, d) {
  const e = actor.empresaId;

  // Lo que había antes, para el historial
  const previosGeneral = new Map((await repo.listarPrecios(db, e, servicioId)).map((r) => [r.tipo_articulo_id, Number(r.precio)]));
  const previosSuc = new Map(
    (await repo.listarPreciosSucursal(db, e, servicioId, actor.sucursales)).map((r) => [
      `${r.tipo_articulo_id}|${r.sucursal_id}`,
      Number(r.precio),
    ])
  );
  const generalNuevo = new Map(d.precios.map((p) => [p.tipoArticuloId, p.precio]));

  // 1. Precio general por tipo de artículo
  await repo.reemplazarPrecios(db, e, servicioId, d.precios);

  // 2. Sucursales (solo las del actor; las demás no se tocan)
  const vinculos = await repo.listarSucursales(db, e, servicioId, actor.sucursales);
  for (const sid of d.sucursalIds) await repo.guardarSucursal(db, e, servicioId, sid);
  const aQuitar = vinculos.map((v) => v.sucursal_id).filter((sid) => !d.sucursalIds.includes(sid));
  if (aQuitar.length) await repo.quitarSucursales(db, e, servicioId, aQuitar);

  // 3. Precios propios por sucursal
  const filas = [];
  for (const [sid, porTipo] of Object.entries(d.preciosSucursal)) {
    for (const [tid, precio] of Object.entries(porTipo)) {
      filas.push({ sucursalId: Number(sid), tipoArticuloId: Number(tid), precio });
    }
  }
  await repo.reemplazarPreciosSucursal(db, e, servicioId, actor.sucursales, filas);

  // 4. Extras
  await repo.reemplazarExtras(db, e, servicioId, d.extraIds);

  // 5. Historial de precios
  const base = { ...quien(actor), entidad: 'servicio', entidadId: servicioId };
  for (const [tid, precio] of generalNuevo) {
    const antes = previosGeneral.get(tid) ?? null;
    if (antes !== precio) await historial.registrar(db, e, { ...base, tipoArticuloId: tid, sucursalId: null, anterior: antes, nuevo: precio });
  }
  const nuevos = new Set(filas.map((f) => `${f.tipoArticuloId}|${f.sucursalId}`));
  for (const f of filas) {
    const antes = previosSuc.get(`${f.tipoArticuloId}|${f.sucursalId}`) ?? null;
    if (antes !== f.precio) {
      await historial.registrar(db, e, { ...base, tipoArticuloId: f.tipoArticuloId, sucursalId: f.sucursalId, anterior: antes, nuevo: f.precio });
    }
  }
  for (const [clave, antes] of previosSuc) {
    if (nuevos.has(clave)) continue;
    const [tid, sid] = clave.split('|').map(Number);
    // Solo si la sucursal y el tipo siguen: el precio propio vuelve al general
    if (d.sucursalIds.includes(sid) && generalNuevo.has(tid)) {
      await historial.registrar(db, e, { ...base, tipoArticuloId: tid, sucursalId: sid, anterior: antes, nuevo: generalNuevo.get(tid) });
    }
  }
}

// ---------- API del servicio ----------
export async function obtenerOpciones(actor) {
  const e = actor.empresaId;
  const lista = (entidad) => catalogoRepo.listar(pool, e, entidad, { activo: true, limite: 100, pagina: 1 });
  const [deptos, tasas, tipos, extras, sucursales] = await Promise.all([
    lista('departamentos'),
    lista('tasasIva'),
    lista('tiposArticulo'),
    extrasRepo.listarActivosSimples(pool, e),
    listarSucursalesPorIds(pool, e, actor.sucursales),
  ]);
  return {
    departamentos: deptos.filas.map(catalogoSer.departamento),
    tasasIva: tasas.filas.map(catalogoSer.tasaIva),
    tiposArticulo: tipos.filas.map(catalogoSer.tipoArticulo),
    extras: extras.map((x) => ({ id: x.id, nombre: x.nombre, precio: Number(x.precio) })),
    sucursales,
    puedeVerContacto: puedeVerContacto(actor),
  };
}

export async function listar(actor, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, actor.sucursales, consulta);
  return { datos: filas.map(ser.servicioLista), total, pagina: consulta.pagina, limite: consulta.limite };
}

export async function obtener(actor, id) {
  const d = await cargarDetalle(pool, actor, id);
  if (!d) throw new ErrorHttp(404, 'Servicio no encontrado');
  return ser.servicio(d, { verContacto: puedeVerContacto(actor) });
}

export async function crear(actor, datos, ip) {
  const base = normalizar(datos);
  validarPayload(actor, base);
  exigirContacto(actor, base);
  const n = base.requiereCotizacion ? paraCotizar(base) : base;

  const detalle = await conTransaccion(async (db) => {
    await validarReferencias(db, actor, {
      departamentoId: n.departamentoId,
      tasaIvaId: n.tasaIvaId,
      sucursalIds: n.sucursalIds,
      tipoIds: n.precios.map((p) => p.tipoArticuloId),
      extraIds: n.extraIds,
    });

    const sku = await skuRepo.reservarSku(db, actor.empresaId, n.departamentoId);
    if (!sku) throw new ErrorHttp(409, 'Ese departamento llegó al máximo de 9,999 artículos');

    const id = await repo.insertar(db, actor.empresaId, {
      sku,
      nombre: n.nombre,
      descripcion: n.descripcion ?? null,
      departamentoId: n.departamentoId,
      tasaIvaId: n.tasaIvaId,
      tiempoHoras: n.tiempoDias == null ? null : n.tiempoDias * 24,
      visiblePublico: n.visiblePublico ?? true,
      usuarioId: actor.id,
      requiereCotizacion: n.requiereCotizacion === true,
      contactoCotizacion: n.requiereCotizacion ? (n.contactoCotizacion ?? null) : null,
    });
    await sincronizar(db, actor, id, n);

    const d = await cargarDetalle(db, actor, id);
    await bitacora(db, actor, 'servicio.crear', id, n.sucursalIds[0], null, ser.servicio(d, { verContacto: true }), ip);
    return d;
  });
  return ser.servicio(detalle, { verContacto: puedeVerContacto(actor) });
}

export async function actualizar(actor, id, datos, ip) {
  if (datos.activo === false && !datos.motivoBaja) throw new ErrorHttp(400, 'Indica el motivo de la baja');
  const bloque = datos.precios !== undefined;
  if (bloque !== (datos.sucursalIds !== undefined)) {
    throw new ErrorHttp(400, 'Los precios y las sucursales se envían juntos');
  }
  let n = normalizar(datos);
  if (bloque) validarPayload(actor, n);
  exigirContacto(actor, n);

  const despues = await conTransaccion(async (db) => {
    const antes = await cargarDetalle(db, actor, id);
    if (!antes) throw new ErrorHttp(404, 'Servicio no encontrado');

    const cambiaCotizacion = n.requiereCotizacion !== undefined && n.requiereCotizacion !== antes.requiere_cotizacion;
    if (cambiaCotizacion && !bloque) {
      throw new ErrorHttp(400, 'El cambio de "requiere cotización" se guarda junto con los precios y las sucursales');
    }
    const requiere = n.requiereCotizacion ?? antes.requiere_cotizacion;
    if (requiere && bloque) n = paraCotizar(n);

    const campos = {};
    if (n.nombre !== undefined) campos.nombre = n.nombre;
    if (n.descripcion !== undefined) campos.descripcion = n.descripcion;
    if (n.visiblePublico !== undefined) campos.visible_publico = n.visiblePublico;
    if (n.tiempoDias !== undefined) campos.tiempo_estimado_horas = n.tiempoDias === null ? null : n.tiempoDias * 24;
    if (n.requiereCotizacion !== undefined) campos.requiere_cotizacion = n.requiereCotizacion;
    if (n.contactoCotizacion !== undefined || n.requiereCotizacion === false) {
      campos.contacto_cotizacion = requiere ? (n.contactoCotizacion ?? null) : null;
    }

    const cambiaDepto = n.departamentoId !== undefined && n.departamentoId !== antes.departamento_id;
    const cambiaTasa = n.tasaIvaId !== undefined && n.tasaIvaId !== antes.tasa_iva_id;
    const reactiva = n.activo === true && !antes.activo;
    await validarReferencias(db, actor, {
      departamentoId: cambiaDepto ? n.departamentoId : reactiva ? antes.departamento_id : undefined,
      tasaIvaId: cambiaTasa ? n.tasaIvaId : reactiva ? antes.tasa_iva_id : undefined,
      sucursalIds: bloque ? n.sucursalIds : undefined,
      tipoIds: bloque ? n.precios.map((p) => p.tipoArticuloId) : undefined,
      extraIds: bloque ? n.extraIds : undefined,
    });
    if (cambiaDepto) campos.departamento_id = n.departamentoId; // el SKU no cambia
    if (cambiaTasa) campos.tasa_iva_id = n.tasaIvaId;

    if (n.activo !== undefined && n.activo !== antes.activo) {
      campos.activo = n.activo;
      campos.baja_en = n.activo ? null : new Date();
      campos.baja_motivo = n.activo ? null : n.motivoBaja;
      campos.baja_por = n.activo ? null : actor.id;
    }

    if (!Object.keys(campos).length && !bloque) throw new ErrorHttp(400, 'No hay cambios');

    await repo.actualizar(db, actor.empresaId, id, { ...campos, actualizado_por: actor.id });
    if (bloque) await sincronizar(db, actor, id, n);

    const d = await cargarDetalle(db, actor, id);
    let accion = 'servicio.editar';
    if (n.activo === false && antes.activo) accion = 'servicio.desactivar';
    if (reactiva) accion = 'servicio.reactivar';
    await bitacora(
      db, actor, accion, id, d.sucursales[0]?.sucursal_id ?? null,
      ser.servicio(antes, { verContacto: true }), ser.servicio(d, { verContacto: true }), ip
    );
    return d;
  });
  return ser.servicio(despues, { verContacto: puedeVerContacto(actor) });
}