import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirGlobal } from '../middlewares/requerirGlobal.js';
import { idParams, crearEmpresaBody, editarEmpresaBody, motivoBody, listaQuery } from '../validators/empresasGlobal.validator.js';
import { paramsEmpresa, paramsSucursal, crearSucursalBody, editarSucursalBody, bajaBody } from '../validators/sucursalesGlobal.validator.js';
import * as ctrl from '../controllers/empresasGlobal.controller.js';
import * as sucursales from '../controllers/sucursalesGlobal.controller.js';

const router = Router();

// Todo esto es solo del administrador global
router.use(requerirGlobal);

// Empresas
router.get('/', validar({ query: listaQuery }), ctrl.listar);
router.post('/', validar({ body: crearEmpresaBody }), ctrl.crear);
router.patch('/:id', validar({ params: idParams, body: editarEmpresaBody }), ctrl.editar);
router.post('/:id/suspension', validar({ params: idParams, body: motivoBody }), ctrl.suspender);
router.delete('/:id/suspension', validar({ params: idParams }), ctrl.reactivar);

// Sucursales de cada empresa
router.get('/:id/sucursales', validar({ params: paramsEmpresa }), sucursales.listar);
router.post('/:id/sucursales', validar({ params: paramsEmpresa, body: crearSucursalBody }), sucursales.crear);
router.patch('/:id/sucursales/:sid', validar({ params: paramsSucursal, body: editarSucursalBody }), sucursales.editar);
router.post('/:id/sucursales/:sid/baja', validar({ params: paramsSucursal, body: bajaBody }), sucursales.darDeBaja);
router.delete('/:id/sucursales/:sid/baja', validar({ params: paramsSucursal }), sucursales.reactivar);

export default { ruta: '/global/empresas', router, publico: false };