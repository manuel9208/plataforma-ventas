import { ErrorHttp } from '../utils/errores.js';
import { moduloActivo } from '../utils/modulos.js';

// Candado comercial: la ruta solo funciona si la empresa tiene el módulo encendido y vigente
// Uso: router.use(requerirModulo('whatsapp_avisos'))
export const requerirModulo = (clave) => async (req, _res, next) => {
  try {
    const empresaId = req.usuario?.empresaId ?? req.empresa?.id;
    if (!empresaId || !(await moduloActivo(empresaId, clave))) {
      return next(new ErrorHttp(403, 'Este módulo no está activo en tu plan'));
    }
    next();
  } catch (err) {
    next(err);
  }
};