import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirGlobal } from '../middlewares/requerirGlobal.js';
import { paramsEmpresa, paramsModulo, guardarModuloBody } from '../validators/modulosGlobal.validator.js';
import * as ctrl from '../controllers/modulosGlobal.controller.js';

const router = Router();

// Solo el administrador global ve y cambia los módulos y sus precios
router.use(requerirGlobal);

router.get('/:id', validar({ params: paramsEmpresa }), ctrl.listar);
router.put('/:id/:clave', validar({ params: paramsModulo, body: guardarModuloBody }), ctrl.guardar);

export default { ruta: '/global/modulos', router, publico: false };