import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as alta from '../repositories/empresasAlta.repository.js';
import * as repo from '../repositories/sucursalesGlobal.repository.js';
import { sucursalGlobal } from '../serializers/sucursalesGlobal.serializer.js';

async function cargarEmpresa(id) {
  const e = await empresas.obtener(pool, id);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  return e;
}

async function cargarSucursal(empresaId, id) {
  const s = await repo.obtener(pool, empresaId, id);
  if (!s) throw new ErrorHttp(404, 'Sucursal no encontrada');
  return s;
}

const bitacora = (db, actor, empresaId, sucursalId, accion, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId,
    sucursalId,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'sucursal',
    entidadId: sucursalId,
    antes,
    despues,
    ip,
  });

export async function listar(empresaId) {
  const e = await cargarEmpresa(empresaId);
  const filas = await repo.listar(pool, empresaId);
  return { empresa: { id: e.id, nombre: e.nombre, slug: e.slug, zonaHoraria: e.zona_horaria }, datos: filas.map((s) => sucursalGlobal(s, e.zona_horaria)) };
}

// Solo el nombre es obligatorio. Se siembra su configuración y su "Caja 1", y se asigna a los administradores.
export async function crear(actor, empresaId, datos, ip) {
  const e = await cargarEmpresa(empresaId);
  try {
    const id = await conTransaccion(async (db) => {
      const sucursalId = await alta.sembrarSucursal(db, empresaId, datos.nombre);
      const campos = {};
      if (datos.direccion) campos.direccion = datos.direccion;
      if (datos.zonaHoraria && datos.zonaHoraria !== e.zona_horaria) campos.zona_horaria = datos.zonaHoraria;
      if (Object.keys(campos).length) await repo.actualizar(db, empresaId, sucursalId, campos);
      const asignados = await repo.asignarAAdministradores(db, empresaId, sucursalId);
      await bitacora(db, actor, empresaId, sucursalId, 'sucursal.crear', null, { nombre: datos.nombre, ...campos, administradores: asignados }, ip);
      return sucursalId;
    });
    return sucursalGlobal(await repo.obtener(pool, empresaId, id), e.zona_horaria);
  } catch (err) {
    if (err.code === '23505') throw new ErrorHttp(409, 'Ya existe una sucursal con ese nombre en esta empresa.');
    throw err;
  }
}

export async function editar(actor, empresaId, id, datos, ip) {
  const e = await cargarEmpresa(empresaId);
  const actual = await cargarSucursal(empresaId, id);

  const campos = {};
  if (datos.nombre !== undefined) campos.nombre = datos.nombre;
  if (datos.direccion !== undefined) campos.direccion = datos.direccion || null;
  if (datos.zonaHoraria !== undefined) {
    const nueva = datos.zonaHoraria && datos.zonaHoraria !== e.zona_horaria ? datos.zonaHoraria : null;
    // Con un turno abierto, cambiar la zona movería la fecha operativa de ese turno
    if (nueva !== actual.zona_horaria && (await repo.turnosAbiertos(pool, empresaId, id)) > 0) {
      throw new ErrorHttp(409, 'No se puede cambiar la zona horaria mientras haya un turno abierto en esta sucursal.');
    }
    campos.zona_horaria = nueva;
  }

  try {
    await conTransaccion(async (db) => {
      await repo.actualizar(db, empresaId, id, campos);
      await bitacora(
        db,
        actor,
        empresaId,
        id,
        'sucursal.editar',
        { nombre: actual.nombre, direccion: actual.direccion, zonaHoraria: actual.zona_horaria },
        { nombre: datos.nombre, direccion: datos.direccion, zonaHoraria: datos.zonaHoraria },
        ip
      );
    });
  } catch (err) {
    if (err.code === '23505') throw new ErrorHttp(409, 'Ya existe una sucursal con ese nombre en esta empresa.');
    throw err;
  }
  return sucursalGlobal(await repo.obtener(pool, empresaId, id), e.zona_horaria);
}

// Baja lógica: nunca se borra. Se bloquea si dejaría la operación sin dónde trabajar.
export async function darDeBaja(actor, empresaId, id, motivo, ip) {
  const e = await cargarEmpresa(empresaId);
  const actual = await cargarSucursal(empresaId, id);
  if (!actual.activo) throw new ErrorHttp(409, 'Esa sucursal ya está de baja');

  if ((await repo.sucursalesActivas(pool, empresaId)) <= 1) {
    throw new ErrorHttp(409, 'Es la única sucursal activa de la empresa. Crea otra antes de darla de baja.');
  }
  if ((await repo.turnosAbiertos(pool, empresaId, id)) > 0) {
    throw new ErrorHttp(409, 'Hay un turno abierto en esta sucursal. Ciérralo desde Cajas → Turnos abiertos y vuelve a intentar.');
  }
  const solos = await repo.empleadosSoloAqui(pool, empresaId, id);
  if (solos > 0) {
    throw new ErrorHttp(
      409,
      `Hay ${solos} ${solos === 1 ? 'empleado que solo trabaja' : 'empleados que solo trabajan'} en esta sucursal. Asígnales otra sucursal o dalos de baja primero.`
    );
  }

  await conTransaccion(async (db) => {
    if (!(await repo.darDeBaja(db, empresaId, id, motivo, actor.adminGlobalId))) throw new ErrorHttp(409, 'Esa sucursal ya está de baja');
    await bitacora(db, actor, empresaId, id, 'sucursal.baja', null, { motivo }, ip);
  });
  return sucursalGlobal(await repo.obtener(pool, empresaId, id), e.zona_horaria);
}

export async function reactivar(actor, empresaId, id, ip) {
  const e = await cargarEmpresa(empresaId);
  const actual = await cargarSucursal(empresaId, id);
  if (actual.activo) throw new ErrorHttp(409, 'Esa sucursal ya está activa');

  await conTransaccion(async (db) => {
    if (!(await repo.reactivar(db, empresaId, id))) throw new ErrorHttp(409, 'Esa sucursal ya está activa');
    await bitacora(db, actor, empresaId, id, 'sucursal.reactivar', { motivo: actual.baja_motivo }, null, ip);
  });
  return sucursalGlobal(await repo.obtener(pool, empresaId, id), e.zona_horaria);
}