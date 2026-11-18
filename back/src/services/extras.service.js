import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/extras.repository.js';
import * as historial from '../repositories/historialPrecios.repository.js';
import * as catalogoRepo from '../repositories/catalogo.repository.js';
import { listarSucursalesPorIds } from '../repositories/usuarios.repository.js';
import * as ser from '../serializers/extras.serializer.js';
import * as catalogoSer from '../serializers/catalogo.serializer.js';

const traducir = (err) =>
  err.code === '23505' ? new ErrorHttp(409, 'Ya existe un extra con ese nombre') : err;

const quien = (actor) => ({ usuarioId: actor.id, adminGlobalId: actor.adminGlobalId });

async function validarTasa(db, actor, tasaIvaId) {
  const t = await catalogoRepo.obtener(db, actor.empresaId, 'tasasIva', tasaIvaId);
  if (!t?.activo) throw new ErrorHttp(400, 'Elige una tasa de IVA activa');
}

function validarSucursales(actor, preciosSucursal) {
  for (const sid of Object.keys(preciosSucursal)) {
    if (!actor.sucursales.includes(Number(sid))) throw new ErrorHttp(403, 'No tienes acceso a una de las sucursales');
  }
}

const bitacora = (db, actor, accion, id, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'extra',
    entidadId: id,
    antes,
    despues,
    ip,
  });

// Guarda los precios propios por sucursal y deja el historial
async function guardarPreciosSucursal(db, actor, extraId, preciosSucursal, precioGeneral) {
  const e = actor.empresaId;
  const previos = await repo.listarPreciosSucursal(db, e, extraId, actor.sucursales);
  const anterior = new Map(previos.map((r) => [r.sucursal_id, Number(r.precio)]));
  const filas = Object.entries(preciosSucursal).map(([sid, precio]) => ({ sucursalId: Number(sid), precio }));

  await repo.reemplazarPreciosSucursal(db, e, extraId, actor.sucursales, filas);

  const nuevos = new Set(filas.map((f) => f.sucursalId));
  for (const f of filas) {
    const antes = anterior.get(f.sucursalId) ?? null;
    if (antes !== f.precio) {
      await historial.registrar(db, e, {
        ...quien(actor), entidad: 'extra', entidadId: extraId, sucursalId: f.sucursalId, anterior: antes, nuevo: f.precio,
      });
    }
  }
  // Los que se quitaron vuelven al precio general
  for (const [sid, antes] of anterior) {
    if (!nuevos.has(sid)) {
      await historial.registrar(db, e, {
        ...quien(actor), entidad: 'extra', entidadId: extraId, sucursalId: sid, anterior: antes, nuevo: precioGeneral,
      });
    }
  }
}

export async function obtenerOpciones(actor) {
  const e = actor.empresaId;
  const [tasas, sucursales] = await Promise.all([
    catalogoRepo.listar(pool, e, 'tasasIva', { activo: true, limite: 100, pagina: 1 }),
    listarSucursalesPorIds(pool, e, actor.sucursales),
  ]);
  return { tasasIva: tasas.filas.map(catalogoSer.tasaIva), sucursales };
}

export async function listar(actor, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, consulta);
  return { datos: filas.map(ser.extra), total, pagina: consulta.pagina, limite: consulta.limite };
}

export async function obtener(actor, id) {
  const fila = await repo.obtener(pool, actor.empresaId, id);
  if (!fila) throw new ErrorHttp(404, 'Extra no encontrado');
  const precios = await repo.listarPreciosSucursal(pool, actor.empresaId, id, actor.sucursales);
  return ser.extraDetalle(fila, precios);
}

export async function crear(actor, datos, ip) {
  validarSucursales(actor, datos.preciosSucursal);
  try {
    return await conTransaccion(async (db) => {
      await validarTasa(db, actor, datos.tasaIvaId);
      const id = await repo.insertar(db, actor.empresaId, datos);
      await historial.registrar(db, actor.empresaId, {
        ...quien(actor), entidad: 'extra', entidadId: id, sucursalId: null, anterior: null, nuevo: datos.precio,
      });
      await guardarPreciosSucursal(db, actor, id, datos.preciosSucursal, datos.precio);

      const fila = await repo.obtener(db, actor.empresaId, id);
      const precios = await repo.listarPreciosSucursal(db, actor.empresaId, id, actor.sucursales);
      const salida = ser.extraDetalle(fila, precios);
      await bitacora(db, actor, 'extra.crear', id, null, salida, ip);
      return salida;
    });
  } catch (err) {
    throw traducir(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  if (datos.preciosSucursal) validarSucursales(actor, datos.preciosSucursal);
  try {
    return await conTransaccion(async (db) => {
      const e = actor.empresaId;
      const antesFila = await repo.obtener(db, e, id);
      if (!antesFila) throw new ErrorHttp(404, 'Extra no encontrado');
      const antes = ser.extraDetalle(antesFila, await repo.listarPreciosSucursal(db, e, id, actor.sucursales));

      const campos = {};
      if (datos.nombre !== undefined) campos.nombre = datos.nombre;
      if (datos.precio !== undefined) campos.precio = datos.precio;
      if (datos.activo !== undefined) campos.activo = datos.activo;
      if (datos.tasaIvaId !== undefined && datos.tasaIvaId !== antesFila.tasa_iva_id) {
        await validarTasa(db, actor, datos.tasaIvaId);
        campos.tasa_iva_id = datos.tasaIvaId;
      }
      if (!Object.keys(campos).length && datos.preciosSucursal === undefined) {
        throw new ErrorHttp(400, 'No hay cambios');
      }

      if (Object.keys(campos).length) await repo.actualizar(db, e, id, campos);

      const precioGeneral = datos.precio ?? Number(antesFila.precio);
      if (datos.precio !== undefined && datos.precio !== Number(antesFila.precio)) {
        await historial.registrar(db, e, {
          ...quien(actor), entidad: 'extra', entidadId: id, sucursalId: null,
          anterior: Number(antesFila.precio), nuevo: datos.precio,
        });
      }
      if (datos.preciosSucursal !== undefined) {
        await guardarPreciosSucursal(db, actor, id, datos.preciosSucursal, precioGeneral);
      }

      const despuesFila = await repo.obtener(db, e, id);
      const despues = ser.extraDetalle(despuesFila, await repo.listarPreciosSucursal(db, e, id, actor.sucursales));

      let accion = 'extra.editar';
      if (antes.activo && !despues.activo) accion = 'extra.desactivar';
      if (!antes.activo && despues.activo) accion = 'extra.reactivar';
      await bitacora(db, actor, accion, id, antes, despues, ip);
      return despues;
    });
  } catch (err) {
    throw traducir(err);
  }
}