import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { listaQuery, turnoParams } from '../validators/cortes.validator.js';
import * as ctrl from '../controllers/cortes.controller.js';

const router = Router();

// El corte detallado es de gerente y administrador
router.use(requerirPermiso('caja.corte_completo'));

router.get('/', validar({ query: listaQuery }), ctrl.listar);
router.get('/en-curso/:turnoId', validar({ params: turnoParams }), ctrl.enCurso);
router.get('/:turnoId', validar({ params: turnoParams }), ctrl.obtener);

export default { ruta: '/cortes', router, publico: false };