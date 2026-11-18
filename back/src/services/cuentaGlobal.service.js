import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import * as admins from '../repositories/adminsGlobales.repository.js';

const salida = (a) => ({ id: a.id, nombre: a.nombre, telefono: a.telefono });

export async function obtener(actor) {
  const a = await admins.obtener(pool, actor.adminGlobalId);
  if (!a) throw new ErrorHttp(404, 'Cuenta no encontrada');
  return salida(a);
}

export async function actualizar(actor, datos) {
  const id = actor.adminGlobalId;
  const actual = await admins.obtener(pool, id);
  if (!actual) throw new ErrorHttp(404, 'Cuenta no encontrada');

  // Cambiar teléfono o contraseña pide la contraseña actual
  const cambiaTelefono = datos.telefono !== undefined && datos.telefono !== actual.telefono;
  if (datos.password || cambiaTelefono) {
    const hash = await admins.obtenerHash(pool, id);
    const ok = datos.passwordActual && (await bcrypt.compare(datos.passwordActual, hash || ''));
    // 403 y no 401: un 401 cerraría la sesión en la pantalla
    if (!ok) throw new ErrorHttp(403, 'La contraseña actual es incorrecta');
  }

  const campos = {};
  if (datos.nombre !== undefined) campos.nombre = datos.nombre;
  if (datos.telefono !== undefined) campos.telefono = datos.telefono;
  if (datos.password) campos.password_hash = await bcrypt.hash(datos.password, 12);
  if (!Object.keys(campos).length) throw new ErrorHttp(400, 'No hay cambios');

  try {
    await admins.actualizar(pool, id, campos);
  } catch (err) {
    if (err.code === '23505') throw new ErrorHttp(409, 'Ese teléfono ya está registrado');
    throw err;
  }
  return salida(await admins.obtener(pool, id));
}