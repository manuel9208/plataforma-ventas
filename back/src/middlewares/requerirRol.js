import { ErrorHttp } from '../utils/errores.js';

export const requerirRol = (roles) => (req, _res, next) => {
  // El administrador global puede entrar a cualquier pantalla de administración
  if (!req.usuario || !(req.usuario.esGlobal || roles.includes(req.usuario.rol))) {
    return next(new ErrorHttp(403, 'Acceso denegado'));
  }
  next();
};