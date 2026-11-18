import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './src/config/env.js';
import { origenPermitido } from './src/utils/origenesPermitidos.js';
import { crearRouterPrincipal } from './src/routes/index.js';
import { asignarRequestId, noEncontrado, manejarErrores } from './src/middlewares/manejarErrores.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(asignarRequestId);
app.use(helmet());
app.use(
  cors({
    // Lista del .env más los dominios que el administrador global guarda en cada empresa (con caché de 1 minuto)
    origin: (origin, callback) =>
      origenPermitido(origin)
        .then((ok) => callback(null, ok))
        .catch(() => callback(null, false)),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Empresa-Slug'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(await crearRouterPrincipal());
app.use(noEncontrado);
app.use(manejarErrores);

app.listen(env.PORT, () => console.log(`Servidor listo en el puerto ${env.PORT}`));