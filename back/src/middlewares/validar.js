import { ErrorHttp } from '../utils/errores.js';

// Uso: validar({ body: esquemaZod, params: esquemaZod, query: esquemaZod })
// Los datos limpios quedan en req.datos.body / req.datos.params / req.datos.query
export const validar = (esquemas) => (req, _res, next) => {
  req.datos = {};
  for (const parte of ['params', 'query', 'body']) {
    if (!esquemas[parte]) continue;
    const r = esquemas[parte].safeParse(req[parte]);
    if (!r.success) {
      const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
      return next(new ErrorHttp(400, 'Datos inválidos', detalles));
    }
    req.datos[parte] = r.data;
  }
  next();
};