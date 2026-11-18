import { UNIDADES, generarCodigoInterno } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/productos.repository.js';
import * as skuRepo from '../repositories/sku.repository.js';
import * as catalogoRepo from '../repositories/catalogo.repository.js';
import { contarSucursalesActivas, listarSucursalesPorIds } from '../repositories/usuarios.repository.js';
import * as ser from '../serializers/productos.serializer.js';
import * as catalogoSer from '../serializers/catalogo.serializer.js';

const verCostos = (actor) => tienePermiso(actor.permisos, 'costos.ver');

function traducirError(err) {
  if (err.code !== '23505') return err;
  const c = err.constraint || '';
  if (c.startsWith('codigos_barras')) {
    const m = /\(codigo, empresa_id\)=\(([^,]+),/.exec(err.detail || '');
    return new ErrorHttp(409, `El código de barras ${m ? m[1] : ''} ya está en uso`.replace('  ', ' '));
  }
  if (c.startsWith('producto_presentaciones')) return new ErrorHttp(409, 'Dos presentaciones tienen el mismo nombre');
  if (c.startsWith('uq_presentacion_base')) return new ErrorHttp(409, 'Solo puede haber una presentación base');
  return new ErrorHttp(409, 'Ese dato ya existe');
}

// Mayoreo: la cantidad no se repite y el precio baja mientras más se compra
function validarMayoreo(p) {
  if (!p.mayoreo.length) return;
  const cantidades = new Set(p.mayoreo.map((r) => r.cantidadMinima));
  if (cantidades.size !== p.mayoreo.length) {
    throw new ErrorHttp(400, `En "${p.nombre}" hay dos precios de mayoreo con la misma cantidad`);
  }
  let tope = Math.min(p.precio, ...Object.values(p.preciosSucursal));
  for (const r of [...p.mayoreo].sort((a, b) => a.cantidadMinima - b.cantidadMinima)) {
    if (r.precio >= tope) {
      throw new ErrorHttp(400, `En "${p.nombre}", el precio de mayoreo debe ser menor al precio normal y bajar mientras más se compra`);
    }
    tope = r.precio;
  }
}


// ---------- Reglas de las presentaciones ----------
function validarPresentaciones(unidadBase, lista) {
  const bases = lista.filter((p) => p.esBase);
  if (bases.length !== 1) throw new ErrorHttp(400, 'Debe haber una sola presentación base');
  if (bases[0].factor !== 1) throw new ErrorHttp(400, 'La presentación base contiene exactamente 1 unidad base');
  if (bases[0].unidad !== unidadBase) {
    throw new ErrorHttp(400, 'La unidad de la presentación base debe ser la unidad base del producto');
  }
  if (!lista.some((p) => p.seVende)) throw new ErrorHttp(400, 'Marca al menos una presentación como "se vende"');

  const nombres = new Set();
  const codigos = new Set();
  for (const p of lista) {
    const n = p.nombre.toLowerCase();
    if (nombres.has(n)) throw new ErrorHttp(400, `La presentación "${p.nombre}" está repetida`);
    nombres.add(n);
    if (p.seVende && p.precio === null) {
      throw new ErrorHttp(400, `La presentación "${p.nombre}" se vende y necesita precio`);
    }
    validarMayoreo(p);
    for (const c of p.codigos) {
      if (codigos.has(c)) throw new ErrorHttp(400, `El código ${c} está repetido`);
      codigos.add(c);
    }
  }
}

function validarSucursalesPayload(actor, lista) {
  const ids = lista.map((s) => s.sucursalId);
  if (new Set(ids).size !== ids.length) throw new ErrorHttp(400, 'Hay una sucursal repetida');
  if (!ids.every((id) => actor.sucursales.includes(id))) {
    throw new ErrorHttp(403, 'No tienes acceso a una de las sucursales');
  }
  return ids;
}

async function validarReferencias(db, actor, { departamentoId, tasaIvaId, sucursalIds }) {
  if (departamentoId !== undefined) {
    const d = await catalogoRepo.obtener(db, actor.empresaId, 'departamentos', departamentoId);
    if (!d?.activo) throw new ErrorHttp(400, 'Elige un departamento activo');
  }
  if (tasaIvaId !== undefined) {
    const t = await catalogoRepo.obtener(db, actor.empresaId, 'tasasIva', tasaIvaId);
    if (!t?.activo) throw new ErrorHttp(400, 'Elige una tasa de IVA activa');
  }
  if (sucursalIds && (await contarSucursalesActivas(db, actor.empresaId, sucursalIds)) !== sucursalIds.length) {
    throw new ErrorHttp(400, 'Sucursal inválida');
  }
}

// ---------- Carga del detalle ----------
async function cargarDetalle(db, actor, id) {
  const e = actor.empresaId;
  const fila = await repo.obtener(db, e, actor.sucursales, id);
  if (!fila) return null;
  const [presentaciones, codigos, sucursales, precios, volumen] = await Promise.all([
    repo.listarPresentaciones(db, e, id, { soloActivas: true }),
    repo.listarCodigos(db, e, id),
    repo.listarProductoSucursales(db, e, id, actor.sucursales),
    repo.listarPreciosSucursal(db, e, id, actor.sucursales),
    repo.listarPreciosVolumen(db, e, id),
  ]);
  return { ...fila, presentaciones, codigos, sucursales, precios, volumen };
}

const bitacora = (db, actor, accion, id, sucursalId, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    sucursalId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'producto',
    entidadId: id,
    antes,
    despues,
    ip,
  });

// ---------- Sincroniza presentaciones, códigos, sucursales y precios ----------
async function sincronizar(db, actor, productoId, datos) {
  const empresaId = actor.empresaId;

  // 1. Presentaciones
  const existentes = await repo.listarPresentaciones(db, empresaId, productoId);
  const porId = new Map(existentes.map((p) => [p.id, p]));
  const porNombre = new Map(existentes.map((p) => [p.nombre, p]));
  const reclamados = new Set(datos.presentaciones.filter((p) => p.id !== undefined).map((p) => p.id));
  const preciosPrevios = await repo.listarPreciosSucursal(db, empresaId, productoId, actor.sucursales);
  const precioPrevio = new Map(preciosPrevios.map((r) => [`${r.presentacion_id}|${r.sucursal_id}`, Number(r.precio)]));

  await repo.limpiarBase(db, empresaId, productoId);

  const guardadas = [];
  for (const p of datos.presentaciones) {
    let id = p.id;
    if (id !== undefined && !porId.has(id)) throw new ErrorHttp(400, 'Presentación inválida');
    if (id === undefined) {
      // Si quitaron y volvieron a agregar una con el mismo nombre, se reutiliza la anterior
      const mismoNombre = porNombre.get(p.nombre);
      if (mismoNombre && !reclamados.has(mismoNombre.id)) {
        id = mismoNombre.id;
        reclamados.add(id);
      }
    }
    const fila = {
      nombre: p.nombre,
      unidad: p.unidad,
      factor: p.factor,
      precio: p.precio,
      seVende: p.seVende,
      seCompra: p.seCompra,
      esBase: p.esBase,
    };
    const previo = id !== undefined ? porId.get(id) : null;
    if (id !== undefined) await repo.actualizarPresentacion(db, empresaId, id, fila);
    else id = await repo.insertarPresentacion(db, empresaId, productoId, fila);

    guardadas.push({
      id,
      entrada: p,
      precioAnterior: previo?.activo && previo.precio !== null ? Number(previo.precio) : null,
    });
  }

  const vigentes = new Set(guardadas.map((g) => g.id));
  const quitadas = existentes.filter((p) => p.activo && !vigentes.has(p.id)).map((p) => p.id);
  if (quitadas.length) await repo.desactivarPresentaciones(db, empresaId, quitadas);

  // 2. Códigos de barras
  const previos = await repo.listarCodigos(db, empresaId, productoId);
  const deseados = new Set();
  for (const g of guardadas) for (const c of g.entrada.codigos) deseados.add(`${g.id}|${c}`);

  const aBorrar = previos.filter(
    (c) => quitadas.includes(c.presentacion_id) || (!c.es_interno && !deseados.has(`${c.presentacion_id}|${c.codigo}`))
  );
  const idsBorrar = new Set(aBorrar.map((c) => c.id));
  if (idsBorrar.size) await repo.borrarCodigos(db, empresaId, [...idsBorrar]);

  const quedan = previos.filter((c) => !idsBorrar.has(c.id));
  const yaExisten = new Set(quedan.map((c) => `${c.presentacion_id}|${c.codigo}`));
  for (const g of guardadas) {
    for (const c of g.entrada.codigos) {
      if (!yaExisten.has(`${g.id}|${c}`)) await repo.insertarCodigo(db, empresaId, g.id, c, false);
    }
    const tieneInterno = quedan.some((c) => c.presentacion_id === g.id && c.es_interno);
    if (g.entrada.generarInterno && !tieneInterno) {
      await repo.insertarCodigo(db, empresaId, g.id, generarCodigoInterno(g.id), true);
    }
  }

  // 3. Sucursales (solo las que el actor tiene; las demás no se tocan)
  const deseadas = datos.sucursales.map((s) => s.sucursalId);
  const vinculos = await repo.listarProductoSucursales(db, empresaId, productoId, actor.sucursales);
  for (const s of datos.sucursales) {
    await repo.guardarSucursal(db, empresaId, productoId, s.sucursalId, s.stockMinimo);
  }
  const aQuitar = vinculos.map((v) => v.sucursal_id).filter((sid) => !deseadas.includes(sid));
  if (aQuitar.length) await repo.quitarSucursales(db, empresaId, productoId, aQuitar);

  // 4. Precios propios por sucursal
  const filas = [];
  for (const g of guardadas) {
    if (!g.entrada.seVende) continue;
    for (const [sid, precio] of Object.entries(g.entrada.preciosSucursal)) {
      const sucursalId = Number(sid);
      if (!deseadas.includes(sucursalId)) {
        throw new ErrorHttp(400, 'Hay un precio para una sucursal que no está seleccionada');
      }
      filas.push({ presentacionId: g.id, sucursalId, precio });
    }
  }
  await repo.reemplazarPrecios(db, empresaId, productoId, actor.sucursales, filas);

  // 5. Historial de precios
  const quien = { usuarioId: actor.id, adminGlobalId: actor.adminGlobalId };
  for (const g of guardadas) {
    if (g.entrada.seVende && g.precioAnterior !== g.entrada.precio) {
      await repo.registrarPrecio(db, empresaId, {
        ...quien,
        sucursalId: null,
        presentacionId: g.id,
        anterior: g.precioAnterior,
        nuevo: g.entrada.precio,
      });
    }
  }
  const nuevos = new Set(filas.map((f) => `${f.presentacionId}|${f.sucursalId}`));
  for (const f of filas) {
    const antes = precioPrevio.get(`${f.presentacionId}|${f.sucursalId}`) ?? null;
    if (antes !== f.precio) {
      await repo.registrarPrecio(db, empresaId, { ...quien, sucursalId: f.sucursalId, presentacionId: f.presentacionId, anterior: antes, nuevo: f.precio });
    }
  }
  for (const [clave, antes] of precioPrevio) {
    if (nuevos.has(clave)) continue;
    const [pid, sid] = clave.split('|').map(Number);
    const g = guardadas.find((x) => x.id === pid);
    if (g?.entrada.seVende) {
      await repo.registrarPrecio(db, empresaId, { ...quien, sucursalId: sid, presentacionId: pid, anterior: antes, nuevo: g.entrada.precio });
    }
  }

  // 6. Reglas de mayoreo
  const filasVolumen = guardadas.flatMap((g) =>
    g.entrada.mayoreo.map((r) => ({ presentacionId: g.id, cantidadMinima: r.cantidadMinima, precio: r.precio }))
  );
  await repo.reemplazarPreciosVolumen(db, empresaId, productoId, filasVolumen);
}

// ---------- API del servicio ----------
export async function obtenerOpciones(actor) {
  const e = actor.empresaId;
  const [deptos, tasas, sucursales] = await Promise.all([
    catalogoRepo.listar(pool, e, 'departamentos', { activo: true, limite: 100, pagina: 1 }),
    catalogoRepo.listar(pool, e, 'tasasIva', { activo: true, limite: 100, pagina: 1 }),
    listarSucursalesPorIds(pool, e, actor.sucursales),
  ]);
  return {
    unidades: UNIDADES,
    departamentos: deptos.filas.map(catalogoSer.departamento),
    tasasIva: tasas.filas.map(catalogoSer.tasaIva),
    sucursales,
    puedeVerCostos: verCostos(actor),
  };
}

export async function listar(actor, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, actor.sucursales, consulta);
  const ver = verCostos(actor);
  return {
    datos: filas.map((f) => ser.productoLista(f, { verCostos: ver })),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
  };
}

export async function obtener(actor, id) {
  const d = await cargarDetalle(pool, actor, id);
  if (!d) throw new ErrorHttp(404, 'Producto no encontrado');
  return ser.producto(d, { verCostos: verCostos(actor) });
}

export async function crear(actor, datos, ip) {
  const ver = verCostos(actor);
  if (datos.costo != null && !ver) throw new ErrorHttp(403, 'No tienes permiso para registrar costos');
  validarPresentaciones(datos.unidadBase, datos.presentaciones);
  const sucursalIds = validarSucursalesPayload(actor, datos.sucursales);

  try {
    const detalle = await conTransaccion(async (db) => {
      await validarReferencias(db, actor, { departamentoId: datos.departamentoId, tasaIvaId: datos.tasaIvaId, sucursalIds });

      const sku = await skuRepo.reservarSku(db, actor.empresaId, datos.departamentoId);
      if (!sku) throw new ErrorHttp(409, 'Ese departamento llegó al máximo de 9,999 artículos');

      const id = await repo.insertar(db, actor.empresaId, {
        sku,
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        marca: datos.marca ?? null,
        departamentoId: datos.departamentoId,
        tasaIvaId: datos.tasaIvaId,
        unidadBase: datos.unidadBase,
        costo: datos.costo ?? null,
        mermaEsperadaPct: datos.mermaEsperadaPct ?? 0,
        controlaInventario: datos.controlaInventario ?? true,
        llevaCaducidad: datos.llevaCaducidad ?? false,
        visiblePublico: datos.visiblePublico ?? true,
        usuarioId: actor.id,
      });
      await sincronizar(db, actor, id, datos);

      const d = await cargarDetalle(db, actor, id);
      await bitacora(db, actor, 'producto.crear', id, sucursalIds[0], null, ser.producto(d), ip);
      return d;
    });
    return ser.producto(detalle, { verCostos: ver });
  } catch (err) {
    throw traducirError(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  const ver = verCostos(actor);
  if (datos.costo !== undefined && !ver) throw new ErrorHttp(403, 'No tienes permiso para editar costos');
  if (datos.activo === false && !datos.motivoBaja) throw new ErrorHttp(400, 'Indica el motivo de la baja');
  if (Boolean(datos.presentaciones) !== Boolean(datos.sucursales)) {
    throw new ErrorHttp(400, 'Las presentaciones y las sucursales se envían juntas');
  }
  const sucursalIds = datos.sucursales ? validarSucursalesPayload(actor, datos.sucursales) : undefined;

  try {
    const despues = await conTransaccion(async (db) => {
      const antes = await cargarDetalle(db, actor, id);
      if (!antes) throw new ErrorHttp(404, 'Producto no encontrado');

      const campos = {};
      if (datos.nombre !== undefined) campos.nombre = datos.nombre;
      if (datos.descripcion !== undefined) campos.descripcion = datos.descripcion;
      if (datos.marca !== undefined) campos.marca = datos.marca;
      if (datos.mermaEsperadaPct !== undefined) campos.merma_esperada_pct = datos.mermaEsperadaPct;
      if (datos.controlaInventario !== undefined) campos.controla_inventario = datos.controlaInventario;
      if (datos.llevaCaducidad !== undefined) campos.lleva_caducidad = datos.llevaCaducidad;
      if (datos.visiblePublico !== undefined) campos.visible_publico = datos.visiblePublico;

      const cambiaDepto = datos.departamentoId !== undefined && datos.departamentoId !== antes.departamento_id;
      const cambiaTasa = datos.tasaIvaId !== undefined && datos.tasaIvaId !== antes.tasa_iva_id;
      const reactiva = datos.activo === true && !antes.activo;
      await validarReferencias(db, actor, {
        departamentoId: cambiaDepto ? datos.departamentoId : reactiva ? antes.departamento_id : undefined,
        tasaIvaId: cambiaTasa ? datos.tasaIvaId : reactiva ? antes.tasa_iva_id : undefined,
        sucursalIds,
      });
      if (cambiaDepto) campos.departamento_id = datos.departamentoId; // el SKU no cambia
      if (cambiaTasa) campos.tasa_iva_id = datos.tasaIvaId;

      const unidadBase = datos.unidadBase ?? antes.unidad_base;
      if (unidadBase !== antes.unidad_base) {
        if (!datos.presentaciones) throw new ErrorHttp(400, 'Al cambiar la unidad base envía también las presentaciones');
        campos.unidad_base = unidadBase;
      }
      if (datos.presentaciones) validarPresentaciones(unidadBase, datos.presentaciones);

      if (datos.costo !== undefined) {
        campos.costo_ultimo = datos.costo;
        if (datos.costo === null || antes.costo_promedio === null) campos.costo_promedio = datos.costo;
      }

      if (datos.activo !== undefined && datos.activo !== antes.activo) {
        campos.activo = datos.activo;
        campos.baja_en = datos.activo ? null : new Date();
        campos.baja_motivo = datos.activo ? null : datos.motivoBaja;
        campos.baja_por = datos.activo ? null : actor.id;
      }

      if (!Object.keys(campos).length && !datos.presentaciones) throw new ErrorHttp(400, 'No hay cambios');

      await repo.actualizar(db, actor.empresaId, id, { ...campos, actualizado_por: actor.id });
      if (datos.presentaciones) await sincronizar(db, actor, id, datos);

      const d = await cargarDetalle(db, actor, id);
      let accion = 'producto.editar';
      if (datos.activo === false && antes.activo) accion = 'producto.desactivar';
      if (reactiva) accion = 'producto.reactivar';
      await bitacora(
        db,
        actor,
        accion,
        id,
        d.sucursales[0]?.sucursal_id ?? null,
        ser.producto(antes),
        { ...ser.producto(d), ...(campos.costo_ultimo !== undefined ? { costoActualizado: true } : {}) },
        ip
      );
      return d;
    });
    return ser.producto(despues, { verCostos: ver });
  } catch (err) {
    throw traducirError(err);
  }
}