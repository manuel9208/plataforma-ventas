import { ErrorHttp } from '../utils/errores.js';

// Revisa que la sucursal pedida (en params, query o body) sea de las del usuario.
// Va DESPUÉS de validar().
export const requerirSucursal = (campo = 'sucursalId') => (req, _res, next) => {
  const d = req.datos || {};
  const valor = Number(d.params?.[campo] ?? d.query?.[campo] ?? d.body?.[campo]);
  if (!Number.isInteger(valor) || !req.usuario.sucursales.includes(valor)) {
    return next(new ErrorHttp(403, 'Sin acceso a esa sucursal'));
  }
  next();
};