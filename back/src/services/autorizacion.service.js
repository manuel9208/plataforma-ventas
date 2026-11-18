import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { verificarPin } from '../utils/pin.js';
import * as repo from '../repositories/entregas.repository.js'; // aquí viven las búsquedas del encargado
import * as intentosRepo from '../repositories/intentos.repository.js';

const MAX_FALLOS = 5;
const VENTANA_MIN = 15;

// Los fallos se guardan con el pool (fuera de la transacción) para que no se deshagan
export async function limitarIntentos(empresaId, clave, mensaje) {
  const f = await intentosRepo.contarFallos(pool, empresaId, clave, '', VENTANA_MIN);
  if (f.porUsuario >= MAX_FALLOS) throw new ErrorHttp(429, mensaje);
}

// Un encargado (con el permiso y de esta sucursal) autoriza con su PIN.
// Si quien está en caja ya tiene el permiso, usa su propio PIN; si no, escribe el teléfono del encargado.
export async function autorizar(actor, sucursalId, a, permiso) {
  const e = actor.empresaId;
  if (!a.telefono && !tienePermiso(actor.permisos, permiso)) {
    throw new ErrorHttp(400, 'Pide a un encargado que autorice: escribe su teléfono y su PIN.');
  }
  const claveActor = `autoriza:${actor.id}`;
  await limitarIntentos(e, claveActor, 'Demasiados intentos de autorización. Espera unos minutos.');
  const fallar = async (mensaje) => {
    await intentosRepo.registrarFallo(pool, e, claveActor, '');
    throw new ErrorHttp(403, mensaje);
  };

  const enc = a.telefono
    ? await repo.autorizadorPorTelefono(pool, e, a.telefono, sucursalId)
    : await repo.autorizadorPorId(pool, e, actor.id, sucursalId);
  // Mismo aviso si no existe, no tiene permiso o es de otra sucursal: no se revela quién es encargado
  if (!enc || !enc.en_sucursal || !enc.pin_hash || !tienePermiso(enc.permisos, permiso)) {
    return fallar('No se pudo autorizar. Revisa el teléfono y el PIN del encargado.');
  }

  const clavePin = `pin:${enc.id}`;
  await limitarIntentos(e, clavePin, 'Demasiados intentos con el PIN de ese encargado. Espera unos minutos.');
  if (!(await verificarPin(a.pin, enc.pin_hash))) {
    await intentosRepo.registrarFallo(pool, e, clavePin, '');
    return fallar('No se pudo autorizar. Revisa el teléfono y el PIN del encargado.');
  }
  await intentosRepo.limpiarFallos(pool, e, clavePin);
  await intentosRepo.limpiarFallos(pool, e, claveActor);
  return { id: enc.id, nombre: enc.nombre };
}