import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirGlobal } from '../middlewares/requerirGlobal.js';
import { paramsEmpresa, paramsGrupo, queryAlcance, queryAlcanceObligatorio, guardarBody, revelarBody } from '../validators/conexionesGlobal.validator.js';
import * as ctrl from '../controllers/conexionesGlobal.controller.js';

const router = Router();

// Solo el administrador global ve y cambia las llaves
router.use(requerirGlobal);

router.get('/:id', validar({ params: paramsEmpresa, query: queryAlcance }), ctrl.listar);
router.put('/:id/:grupo', validar({ params: paramsGrupo, query: queryAlcance, body: guardarBody }), ctrl.guardar);
router.delete('/:id/:grupo', validar({ params: paramsGrupo, query: queryAlcanceObligatorio }), ctrl.quitar);
router.post('/:id/revelar', validar({ params: paramsEmpresa, body: revelarBody }), ctrl.revelar);

export default { ruta: '/global/conexiones', router, publico: false };