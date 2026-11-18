import crypto from 'node:crypto';

export function asignarRequestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function noEncontrado(_req, res) {
  res.status(404).json({ error: 'No encontrado' });
}

export function manejarErrores(err, req, res, _next) {
  const esJsonMalo = err.type === 'entity.parse.failed';
  const status = esJsonMalo ? 400 : err.status >= 400 && err.status < 500 ? err.status : 500;

  if (status === 500) {
    // El detalle técnico solo va al log, nunca al usuario
    console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, err.stack || err);
  }

  res.status(status).json({
    error: status === 500 ? 'Error interno' : esJsonMalo ? 'JSON inválido' : err.message,
    ...(status < 500 && err.detalles ? { detalles: err.detalles } : {}),
    requestId: req.id,
  });
}