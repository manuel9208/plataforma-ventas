import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { firmarToken } from '../utils/tokens.js';
import { ErrorHttp } from '../utils/errores.js';
import * as usuarios from '../repositories/usuarios.repository.js';
import * as intentos from '../repositories/intentos.repository.js';
import { serializarSesion } from '../serializers/auth.serializer.js';
import * as adminsGlobales from '../repositories/adminsGlobales.repository.js';
import { construirActorGlobal } from '../utils/actorGlobal.js';
import { modulosActivos } from '../utils/modulos.js';

const DURACION_TOKEN_SEG = 12 * 60 * 60;
const VENTANA_MIN = 15;
const MAX_POR_TELEFONO = 5;
const MAX_POR_IP = 30;

// Se compara contra esto cuando el teléfono no existe, para que tarde igual
const HASH_FALSO = bcrypt.hashSync(crypto.randomUUID(), 12);

export async function iniciarSesion(empresa, { telefono, password }, ip) {
  const fallos = await intentos.contarFallos(pool, empresa.id, telefono, ip, VENTANA_MIN);
  if (fallos.porUsuario >= MAX_POR_TELEFONO || fallos.porIp >= MAX_POR_IP) {
    throw new ErrorHttp(429, 'Demasiados intentos. Espera unos minutos.');
  }

  // El administrador global entra por el mismo formulario (se prueba primero)
  const global = await adminsGlobales.buscarParaLogin(pool, telefono);
  const okGlobal = await bcrypt.compare(password, global?.password_hash || HASH_FALSO);
  if (global && okGlobal && global.activo) {
    await intentos.limpiarFallos(pool, empresa.id, telefono);
    const actor = await construirActorGlobal(empresa.id, await adminsGlobales.obtener(pool, global.id));
    const token = firmarToken('global', { gid: global.id }, DURACION_TOKEN_SEG);
    const sucursales = await usuarios.listarSucursalesPorIds(pool, empresa.id, actor.sucursales);
    return { token, ...serializarSesion(actor, sucursales, empresa, await modulosActivos(empresa.id)) };
  }

  const fila = await usuarios.buscarParaLogin(pool, empresa.id, telefono);
  const coincide = await bcrypt.compare(password, fila?.password_hash || HASH_FALSO);

  // Mismo mensaje para teléfono inexistente, contraseña mala o usuario inactivo
  if (!fila || !coincide || !fila.activo) {
    await intentos.registrarFallo(pool, empresa.id, telefono, ip);
    throw new ErrorHttp(401, 'Teléfono o contraseña incorrectos');
  }

  const sesion = await usuarios.cargarSesion(pool, empresa.id, fila.id);
  if (!sesion) throw new ErrorHttp(401, 'Teléfono o contraseña incorrectos');
  if (!sesion.sucursales.length) throw new ErrorHttp(403, 'Tu usuario no tiene sucursales asignadas');

  await intentos.limpiarFallos(pool, empresa.id, telefono);

  const token = firmarToken(
    'empleado',
    { uid: sesion.id, eid: empresa.id, sid: sesion.sucursales, rol: sesion.rol },
    DURACION_TOKEN_SEG
  );
  const sucursales = await usuarios.listarSucursalesPorIds(pool, empresa.id, sesion.sucursales);
  return { token, ...serializarSesion(sesion, sucursales, empresa, await modulosActivos(empresa.id)) };
}

export async function obtenerPerfil(empresa, actor) {
  const sucursales = await usuarios.listarSucursalesPorIds(pool, empresa.id, actor.sucursales);
  return serializarSesion(actor, sucursales, empresa, await modulosActivos(empresa.id));
}