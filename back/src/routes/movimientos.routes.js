import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { idParams, crearBody, anularBody } from '../validators/movimientos.validator.js';
import * as ctrl from '../controllers/movimientos.controller.js';

const router = Router();

router.use(requerirPermiso('pantalla.caja'));

router.get('/', ctrl.listar);
router.post('/', validar({ body: crearBody }), ctrl.crear);
router.post('/:id/anulacion', validar({ params: idParams, body: anularBody }), ctrl.anular);

export default { ruta: '/movimientos', router, publico: false };