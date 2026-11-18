import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { idParams, abrirBody, cerrarBody } from '../validators/turnos.validator.js';
import * as ctrl from '../controllers/turnos.controller.js';

const router = Router();

router.use(requerirPermiso('pantalla.caja'));

router.get('/actual', ctrl.actual);
router.get('/abiertos', requerirPermiso('caja.administrar'), ctrl.abiertos);
router.post('/abrir', validar({ body: abrirBody }), ctrl.abrir);
router.post('/:id/cerrar', validar({ params: idParams, body: cerrarBody }), ctrl.cerrar);

export default { ruta: '/turnos', router, publico: false };