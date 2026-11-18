import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { catalogoQuery } from '../validators/publico.validator.js';
import * as ctrl from '../controllers/publico.controller.js';

const router = Router();

router.get('/sucursales', ctrl.sucursales);
router.get('/catalogo', validar({ query: catalogoQuery }), ctrl.catalogo);

// Sin sesión: solo lectura, de lo que la empresa marcó como visible
export default { ruta: '/publico', router, publico: true };