import { verificarToken } from '../utils/tokens.js';
import { ErrorHttp } from '../utils/errores.js';
import { pool } from '../config/db.js';
import * as repo from '../repositories/miCuenta.repository.js';

// Versión del PIN: si la tienda lo restablece o el cliente lo cambia, las sesiones anteriores dejan de servir
export const versionPin = (f) => (f.pin_creado_en ? new Date(f.pin_creado_en).getTime() : 0);

export async function autenticarCliente(req, _res, next) {
  try {
    const cabecera = req.get('Authorization') || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    const payload = verificarToken('cliente', token);
    if (!payload?.cid) throw new ErrorHttp(401, 'Tu sesión terminó. Entra otra vez.');
    if (!req.empresa || payload.eid !== req.empresa.id) throw new ErrorHttp(403, 'Acceso denegado');

    const fila = await repo.obtener(pool, payload.eid, payload.cid);
    if (!fila || !fila.activo || !fila.tiene_pin || payload.pv !== versionPin(fila)) {
      throw new ErrorHttp(401, 'Tu sesión terminó. Entra otra vez.');
    }
    req.cliente = { id: fila.id, empresaId: payload.eid, telefono: fila.telefono, nombre: fila.nombre };
    next();
  } catch (err) {
    next(err);
  }
}