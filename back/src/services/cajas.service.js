import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/cajas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import { listarSucursalesPorIds } from '../repositories/usuarios.repository.js';
import * as ser from '../serializers/cajas.serializer.js';

const traducir = (err) =>
  err.code === '23505' ? new ErrorHttp(409, 'Ya existe una caja con ese nombre en esa sucursal') : err;

const exigirSucursal = (actor, sucursalId) => {
  if (!actor.sucursales.includes(sucursalId)) throw new ErrorHttp(403, 'No tienes acceso a esa sucursal');
};

const bitacora = (db, actor, accion, entidad, id, sucursalId, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    sucursalId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad,
    entidadId: id,
    antes,
    despues,
    ip,
  });

export async function obtenerOpciones(actor) {
  return { sucursales: await listarSucursalesPorIds(pool, actor.empresaId, actor.sucursales) };
}

export async function listar(actor, consulta) {
  if (consulta.sucursalId !== undefined) exigirSucursal(actor, consulta.sucursalId);
  const filas = await repo.listar(pool, actor.empresaId, actor.sucursales, consulta);
  return filas.map(ser.caja);
}

export async function listarUsuarios(actor, sucursalId) {
  exigirSucursal(actor, sucursalId);
  const filas = await repo.listarUsuariosAsignables(pool, actor.empresaId, sucursalId, actor.nivel, actor.id);
  return filas.map(ser.usuarioAsignable);
}

export async function crear(actor, datos, ip) {
  exigirSucursal(actor, datos.sucursalId);
  try {
    return await conTransaccion(async (db) => {
      const activas = await listarSucursalesPorIds(db, actor.empresaId, [datos.sucursalId]);
      if (!activas.length) throw new ErrorHttp(400, 'Sucursal inválida');

      const id = await repo.insertar(db, actor.empresaId, datos);
      const salida = ser.caja(await repo.obtener(db, actor.empresaId, actor.sucursales, id));
      await bitacora(db, actor, 'caja.crear', 'caja', id, datos.sucursalId, null, salida, ip);
      return salida;
    });
  } catch (err) {
    throw traducir(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  try {
    return await conTransaccion(async (db) => {
      const antesFila = await repo.obtener(db, actor.empresaId, actor.sucursales, id);
      if (!antesFila) throw new ErrorHttp(404, 'Caja no encontrada');

      const campos = {};
      if (datos.nombre !== undefined) campos.nombre = datos.nombre;
      if (datos.activo !== undefined) campos.activo = datos.activo;
      if (datos.anchoPapel !== undefined) campos.ancho_papel = datos.anchoPapel;
      if (datos.corteAutomatico !== undefined) campos.corte_automatico = datos.corteAutomatico;
      if (datos.abrirCajon !== undefined) campos.abrir_cajon = datos.abrirCajon;
      if (datos.imprimirArea !== undefined) campos.imprimir_area = datos.imprimirArea;

      if (datos.activo === false && antesFila.activo) {
        if (antesFila.turno_abierto) {
          throw new ErrorHttp(409, `No se puede desactivar: ${antesFila.turno_abierto.usuario} tiene un turno abierto.`);
        }
        const n = await repo.contarUsuarios(db, actor.empresaId, id);
        if (n > 0) {
          throw new ErrorHttp(409, `No se puede desactivar: tiene ${n} empleado(s) asignado(s). Asígnalos a otra caja primero.`);
        }
      }
      if (!Object.keys(campos).length) throw new ErrorHttp(400, 'No hay cambios');

      await repo.actualizar(db, actor.empresaId, id, campos);
      const antes = ser.caja(antesFila);
      const despues = ser.caja(await repo.obtener(db, actor.empresaId, actor.sucursales, id));

      let accion = 'caja.editar';
      if (antes.activo && !despues.activo) accion = 'caja.desactivar';
      if (!antes.activo && despues.activo) accion = 'caja.reactivar';
      await bitacora(db, actor, accion, 'caja', id, antesFila.sucursal_id, antes, despues, ip);
      return despues;
    });
  } catch (err) {
    throw traducir(err);
  }
}

// Asigna (o quita, con cajaId null) la caja de un empleado. Cada empleado tiene una sola caja.
export async function asignar(actor, { usuarioId, cajaId }, ip) {
  return conTransaccion(async (db) => {
    const e = actor.empresaId;
    const objetivo = await repo.buscarUsuarioParaCaja(db, e, usuarioId);
    if (!objetivo || !objetivo.activo) throw new ErrorHttp(404, 'Empleado no encontrado');

    // Solo a niveles mayores al propio, o a uno mismo
    if (objetivo.id !== actor.id && objetivo.nivel <= actor.nivel) throw new ErrorHttp(403, 'No puedes asignar caja a ese empleado');

    // No se le cambia la caja a quien tiene un turno abierto
    if (await turnosRepo.turnoAbiertoDeUsuario(db, e, usuarioId)) {
      throw new ErrorHttp(409, 'Ese empleado tiene un turno abierto. Pídele que lo cierre primero.');
    }

    if (cajaId === null) {
      if (objetivo.caja_id === null) throw new ErrorHttp(400, 'Ese empleado no tiene caja asignada');
      const anterior = await repo.obtener(db, e, actor.sucursales, objetivo.caja_id);
      if (!anterior) throw new ErrorHttp(403, 'No tienes acceso a la sucursal de esa caja');
      await repo.quitarAsignacion(db, e, usuarioId);
      await bitacora(db, actor, 'caja.quitar_usuario', 'caja_usuario', usuarioId, anterior.sucursal_id, { cajaId: anterior.id }, { cajaId: null }, ip);
      return { usuarioId, cajaId: null };
    }

    const caja = await repo.obtener(db, e, actor.sucursales, cajaId);
    if (!caja) throw new ErrorHttp(404, 'Caja no encontrada');
    if (!caja.activo) throw new ErrorHttp(400, 'Esa caja está desactivada');
    if (!objetivo.sucursal_ids.includes(caja.sucursal_id)) {
      throw new ErrorHttp(400, 'Ese empleado no pertenece a la sucursal de esa caja');
    }

    await repo.asignar(db, e, usuarioId, cajaId);
    await bitacora(db, actor, 'caja.asignar_usuario', 'caja_usuario', usuarioId, caja.sucursal_id, { cajaId: objetivo.caja_id }, { cajaId }, ip);
    return { usuarioId, cajaId };
  });
}