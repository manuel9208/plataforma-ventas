import { verificarToken } from '../utils/tokens.js';
import { ErrorHttp } from '../utils/errores.js';
import { pool } from '../config/db.js';
import { cargarSesion } from '../repositories/usuarios.repository.js';
import * as adminsGlobales from '../repositories/adminsGlobales.repository.js';
import { construirActorGlobal } from '../utils/actorGlobal.js';

export async function autenticar(req, _res, next) {
  try {
    const cabecera = req.get('Authorization') || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;

    // Administrador global: su token tiene llave propia y vale en cualquier empresa
    const global = verificarToken('global', token);
    if (global?.gid) {
      const admin = await adminsGlobales.obtener(pool, global.gid);
      if (!admin || !admin.activo || !req.empresa) throw new ErrorHttp(401, 'No autorizado');
      req.usuario = await construirActorGlobal(req.empresa.id, admin);
      return next();
    }

    const payload = verificarToken('empleado', token);
    if (!payload) throw new ErrorHttp(401, 'No autorizado');

    // El token debe ser de la misma empresa que el header X-Empresa-Slug
    if (!req.empresa || payload.eid !== req.empresa.id) throw new ErrorHttp(403, 'Acceso denegado');

    // El alcance real sale de la base de datos, no del token
    const sesion = await cargarSesion(pool, payload.eid, payload.uid);
    if (!sesion || !sesion.activo) throw new ErrorHttp(401, 'No autorizado');

    req.usuario = {
      id: sesion.id,
      empresaId: payload.eid,
      telefono: sesion.telefono,
      nombre: sesion.nombre,
      rol: sesion.rol,
      nivel: sesion.nivel,
      permisos: sesion.permisos || {},
      sucursales: sesion.sucursales,
    };
    next();
  } catch (err) {
    next(err);
  }
}