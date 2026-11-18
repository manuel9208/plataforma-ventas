import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';

// El backend no conoce los módulos: solo compara la clave que le pasas
export const requerirPermiso = (clave) => (req, _res, next) => {
  if (!req.usuario || !tienePermiso(req.usuario.permisos, clave)) {
    return next(new ErrorHttp(403, 'Acceso denegado'));
  }
  next();
};