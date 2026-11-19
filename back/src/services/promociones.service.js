import { permiteDecimales, validarPromocion } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as configRepo from '../repositories/configuracion.repository.js';
import * as repo from '../repositories/promociones.repository.js';
import { opcion, promocionDetalle, promocionLista } from '../serializers/promociones.serializer.js';

const NO_EXISTE = 'Uno de los elementos elegidos ya no existe o está dado de baja.';

// Quién puede qué: una promoción para TODAS las sucursales exige acceso a todas, igual que en Configuración
async function contexto(actor) {
  const e = await empresas.obtener(pool, actor.empresaId);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  const activas = (await configRepo.listarSucursales(pool, actor.empresaId)).filter((s) => s.activo);
  const propias = activas.filter((s) => actor.sucursales.includes(s.id));
  if (!propias.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  return {
    e,
    activas,
    propias,
    propiasIds: propias.map((s) => s.id),
    puedeTodas: activas.every((s) => actor.sucursales.includes(s.id)),
  };
}

const sucursalIdsDe = (f) => (f.sucursal_ids ?? []).map(Number);
const esVisible = (ctx, ids) => ids.length === 0 || ids.some((id) => ctx.propiasIds.includes(id));
const puedeEditar = (ctx, ids) => (ids.length ? ids.every((id) => ctx.propiasIds.includes(id)) : ctx.puedeTodas);

const autor = (actor) => ({ usuarioId: actor.id ?? null, adminGlobalId: actor.adminGlobalId ?? null });

const registrar = (db, actor, accion, id, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'promocion',
    entidadId: id,
    antes,
    despues,
    ip,
  });

// Resumen para la bitácora: sirve tanto para el detalle ya guardado como para lo que se va a guardar
const resumen = (d) => ({
  nombre: d.nombre,
  tipo: d.tipo,
  modo: d.modo,
  valor: d.valor,
  precioCombo: d.precioCombo,
  lleva: d.lleva,
  paga: d.paga,
  aplicaA: d.aplicaA,
  objetivos: d.objetivos.length,
  articulosCombo: d.items.length,
  sucursalIds: d.sucursalIds,
  desde: d.desde,
  hasta: d.hasta,
  dias: d.dias,
  horaDesde: d.horaDesde,
  horaHasta: d.horaHasta,
});

function normalizar(datos) {
  const r = validarPromocion(datos);
  if (!r.ok) throw new ErrorHttp(400, r.error);
  return r.valor;
}

async function cargar(db, ctx, empresaId, id, opciones) {
  const fila = await repo.obtener(db, empresaId, id, opciones);
  const sucursalIds = fila ? sucursalIdsDe(fila) : [];
  if (!fila || !esVisible(ctx, sucursalIds)) throw new ErrorHttp(404, 'Promoción no encontrada');
  return { fila, sucursalIds };
}

async function detalle(db, ctx, empresaId, id) {
  const { fila, sucursalIds } = await cargar(db, ctx, empresaId, id);
  const [objetivos, items] = await Promise.all([repo.objetivos(db, empresaId, id), repo.items(db, empresaId, id)]);
  return promocionDetalle(fila, { objetivos, items, zona: ctx.e.zona_horaria, puedeEditar: puedeEditar(ctx, sucursalIds) });
}

// Todo lo elegido debe existir en esta empresa, y el giro y las sucursales deben cuadrar
async function revisarReferencias(db, empresaId, ctx, p) {
  const limpieza = ctx.e.tipo_negocio === 'limpieza';
  const de = (tipo) => [...new Set(p.objetivos.filter((o) => o.tipo === tipo).map((o) => o.id))];
  const servicios = [...new Set([...de('servicio'), ...p.items.filter((i) => i.servicioId).map((i) => i.servicioId)])];
  const tipos = [...new Set(p.items.filter((i) => i.tipoArticuloId).map((i) => i.tipoArticuloId))];
  if (!limpieza && (servicios.length || tipos.length)) throw new ErrorHttp(400, 'Este tipo de negocio no vende servicios.');

  const pruebas = [
    ['departamento', de('departamento')],
    ['producto', de('producto')],
    ['servicio', servicios],
    ['tipoArticulo', tipos],
  ];
  for (const [clave, lista] of pruebas) {
    if (lista.length && (await repo.contarExistentes(db, empresaId, clave, lista)) !== lista.length) throw new ErrorHttp(409, NO_EXISTE);
  }

  const pres = [...new Set(p.items.filter((i) => i.presentacionId).map((i) => i.presentacionId))];
  if (pres.length) {
    const filas = await repo.presentaciones(db, empresaId, pres);
    if (filas.length !== pres.length) throw new ErrorHttp(409, NO_EXISTE);
    // Un combo cuenta piezas enteras: lo que se vende por peso o medida no entra
    if (filas.some((f) => permiteDecimales(f.unidad))) throw new ErrorHttp(400, 'Un combo no puede llevar productos a granel.');
  }

  const activas = ctx.activas.map((s) => s.id);
  if (p.sucursalIds.some((id) => !activas.includes(id))) throw new ErrorHttp(400, 'Hay una sucursal que no existe o está dada de baja.');
  if (!puedeEditar(ctx, p.sucursalIds)) {
    throw new ErrorHttp(
      403,
      p.sucursalIds.length
        ? 'Solo puedes usar tus sucursales.'
        : 'Para una promoción en todas las sucursales necesitas acceso a todas. Elige tus sucursales.'
    );
  }
}

const conNombreUnico = (err) => (err.code === '23505' ? new ErrorHttp(409, 'Ya existe una promoción con ese nombre.') : err);

// ---------- Consultas ----------
export async function listar(actor, consulta) {
  const ctx = await contexto(actor);
  const { filas, total } = await repo.listar(pool, actor.empresaId, ctx.propiasIds, consulta);
  return {
    datos: filas.map((f) => promocionLista(f, { zona: ctx.e.zona_horaria, puedeEditar: puedeEditar(ctx, sucursalIdsDe(f)) })),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
  };
}

export async function opciones(actor) {
  const ctx = await contexto(actor);
  const limpieza = ctx.e.tipo_negocio === 'limpieza';
  const [departamentos, tiposArticulo] = await Promise.all([
    repo.departamentos(pool, actor.empresaId),
    limpieza ? repo.tiposArticulo(pool, actor.empresaId) : [],
  ]);
  return {
    giro: ctx.e.tipo_negocio,
    puedeTodas: ctx.puedeTodas,
    sucursales: ctx.propias.map((s) => ({ id: s.id, nombre: s.nombre })),
    departamentos: departamentos.map(opcion),
    tiposArticulo: tiposArticulo.map(opcion),
  };
}

export async function buscar(actor, { tipo, buscar: texto }) {
  const ctx = await contexto(actor);
  if (tipo === 'servicio' && ctx.e.tipo_negocio !== 'limpieza') return [];
  const filas = await repo.buscarOpciones(pool, actor.empresaId, tipo, texto);
  if (tipo !== 'presentacion') return filas.map(opcion);
  return filas
    .filter((f) => !permiteDecimales(f.unidad))
    .map((f) => ({
      id: Number(f.id),
      nombre: f.producto.toLowerCase() === f.presentacion.toLowerCase() ? f.producto : `${f.producto} · ${f.presentacion}`,
      sku: f.sku,
    }));
}

export async function obtener(actor, id) {
  const ctx = await contexto(actor);
  return detalle(pool, ctx, actor.empresaId, id);
}

// ---------- Cambios ----------
export async function crear(actor, datos, ip) {
  const ctx = await contexto(actor);
  const p = normalizar(datos);
  try {
    return await conTransaccion(async (db) => {
      await revisarReferencias(db, actor.empresaId, ctx, p);
      const id = await repo.insertar(db, actor.empresaId, p, autor(actor));
      await repo.reemplazarDetalle(db, actor.empresaId, id, p);
      await registrar(db, actor, 'promocion.crear', id, null, resumen(p), ip);
      return detalle(db, ctx, actor.empresaId, id);
    });
  } catch (err) {
    throw conNombreUnico(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  const ctx = await contexto(actor);
  const p = normalizar(datos);
  try {
    return await conTransaccion(async (db) => {
      const { fila, sucursalIds } = await cargar(db, ctx, actor.empresaId, id, { bloquear: true });
      if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de esta promoción.');
      if (p.tipo !== fila.tipo) throw new ErrorHttp(400, 'El tipo de promoción no se puede cambiar. Crea una nueva.');
      await revisarReferencias(db, actor.empresaId, ctx, p);

      const antes = resumen(await detalle(db, ctx, actor.empresaId, id));
      await repo.actualizar(db, actor.empresaId, id, p);
      await repo.reemplazarDetalle(db, actor.empresaId, id, p);
      await registrar(db, actor, 'promocion.editar', id, antes, resumen(p), ip);
      return detalle(db, ctx, actor.empresaId, id);
    });
  } catch (err) {
    throw conNombreUnico(err);
  }
}

export async function encender(actor, id, encendida, ip) {
  const ctx = await contexto(actor);
  return conTransaccion(async (db) => {
    const { fila, sucursalIds } = await cargar(db, ctx, actor.empresaId, id, { bloquear: true });
    if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de esta promoción.');
    if (fila.encendida === encendida) return detalle(db, ctx, actor.empresaId, id);
    await repo.cambiarEncendida(db, actor.empresaId, id, encendida);
    await registrar(db, actor, encendida ? 'promocion.encender' : 'promocion.apagar', id, { encendida: !encendida }, { encendida }, ip);
    return detalle(db, ctx, actor.empresaId, id);
  });
}

// Nunca se borra: queda dada de baja con motivo, fecha y quién
export async function darDeBaja(actor, id, motivo, ip) {
  const ctx = await contexto(actor);
  return conTransaccion(async (db) => {
    const { fila, sucursalIds } = await cargar(db, ctx, actor.empresaId, id, { bloquear: true });
    if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de esta promoción.');
    if (!(await repo.darDeBaja(db, actor.empresaId, id, motivo, autor(actor)))) throw new ErrorHttp(409, 'La promoción ya estaba dada de baja.');
    await registrar(db, actor, 'promocion.baja', id, { nombre: fila.nombre, tipo: fila.tipo }, { motivo }, ip);
    return { ok: true };
  });
}