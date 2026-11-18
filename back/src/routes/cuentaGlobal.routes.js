import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirGlobal } from '../middlewares/requerirGlobal.js';
import { actualizarCuentaBody } from '../validators/cuentaGlobal.validator.js';
import * as ctrl from '../controllers/cuentaGlobal.controller.js';

const router = Router();
router.use(requerirGlobal);
router.get('/', ctrl.obtener);
router.patch('/', validar({ body: actualizarCuentaBody }), ctrl.actualizar);

export default { ruta: '/global/cuenta', router, publico: false };