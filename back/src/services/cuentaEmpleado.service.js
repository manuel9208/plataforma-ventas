import bcrypt from 'bcryptjs';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { hashPin } from '../utils/pin.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { limitarIntentos } from './autorizacion.service.js';
import * as intentosRepo from '../repositories/intentos.repository.js';
import * as usuariosRepo from '../repositories/usuarios.repository.js';
import * as repo from '../repositories/cuentaEmpleado.repository.js';
import { serializarCuentaEmpleado } from '../serializers/cuentaEmpleado.serializer.js';

// El AdminGlobal tiene su propia cuenta; aquí solo entran empleados
const soloEmpleado = (actor) => {
  if (actor.esGlobal || !actor.id) throw new ErrorHttp(403, 'Esta opción es para empleados');
};

// Revisa la contraseña actual, con límite de intentos guardado en la base de datos
async function verificarActual(actor, passwordActual) {
  const e = actor.empresaId;
  const clave = `cuenta:${actor.id}`;
  await limitarIntentos(e, clave, 'Demasiados intentos. Espera unos minutos.');
  const hash = await repo.passwordHash(pool, e, actor.id);
  if (!hash || !(await bcrypt.compare(passwordActual, hash))) {
    await intentosRepo.registrarFallo(pool, e, clave, '');
    throw new ErrorHttp(400, 'La contraseña actual no es correcta');
  }
  await intentosRepo.limpiarFallos(pool, e, clave);
  return hash;
}

async function guardar(actor, campos, accion, despues, ip) {
  await conTransaccion(async (db) => {
    await usuariosRepo.actualizar(db, actor.empresaId, actor.id, campos);
    await registrarBitacora(db, {
      empresaId: actor.empresaId,
      sucursalId: actor.sucursales[0] ?? null,
      usuarioId: actor.id,
      accion,
      entidad: 'usuario',
      entidadId: actor.id,
      despues,
      ip,
    });
  });
}

export async function ver(actor) {
  soloEmpleado(actor);
  const fila = await repo.obtenerPerfil(pool, actor.empresaId, actor.id);
  if (!fila) throw new ErrorHttp(404, 'Usuario no encontrado');
  const sucursales = await usuariosRepo.listarSucursalesPorIds(pool, actor.empresaId, actor.sucursales);
  return serializarCuentaEmpleado(fila, sucursales);
}

export async function cambiarPassword(actor, { passwordActual, passwordNueva }, ip) {
  soloEmpleado(actor);
  const hash = await verificarActual(actor, passwordActual);
  if (await bcrypt.compare(passwordNueva, hash)) {
    throw new ErrorHttp(400, 'La nueva contraseña debe ser distinta a la actual');
  }
  const nuevoHash = await bcrypt.hash(passwordNueva, 12);
  await guardar(actor, { password_hash: nuevoHash }, 'cuenta.cambiar_password', { passwordCambiada: true }, ip);
  return { ok: true };
}

// La bitácora nunca lleva el PIN
export async function cambiarPin(actor, { passwordActual, pin }, ip) {
  soloEmpleado(actor);
  await verificarActual(actor, passwordActual);
  const pinHash = await hashPin(pin);
  await guardar(actor, { pin_hash: pinHash }, 'cuenta.cambiar_pin', { pinCambiado: true }, ip);
  return { ok: true };
}