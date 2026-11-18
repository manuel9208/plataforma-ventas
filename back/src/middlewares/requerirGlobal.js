import { ErrorHttp } from '../utils/errores.js';

// Para pantallas y rutas que solo puede usar el administrador global
export function requerirGlobal(req, _res, next) {
  if (!req.usuario?.esGlobal) return next(new ErrorHttp(403, 'Acceso denegado'));
  next();
}