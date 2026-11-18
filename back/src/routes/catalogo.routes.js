import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import * as v from '../validators/catalogo.validator.js';
import * as ctrl from '../controllers/catalogo.controller.js';

const router = Router();

router.use(
  requerirRol(['administrador', 'gerente']),
  requerirPermiso('pantalla.admin'),
  requerirPermiso('catalogo.gestionar')
);

router.get('/departamentos', validar({ query: v.listarQuery }), ctrl.listar('departamentos'));
router.post('/departamentos', validar({ body: v.crearDepartamentoBody }), ctrl.crearDepartamento);
router.patch(
  '/departamentos/:id',
  validar({ params: v.idParams, body: v.actualizarDepartamentoBody }),
  ctrl.actualizarDepartamento
);

router.get('/tipos-articulo', validar({ query: v.listarQuery }), ctrl.listar('tiposArticulo'));
router.post('/tipos-articulo', validar({ body: v.crearTipoBody }), ctrl.crearTipoArticulo);
router.patch(
  '/tipos-articulo/:id',
  validar({ params: v.idParams, body: v.actualizarTipoBody }),
  ctrl.actualizarTipoArticulo
);

router.get('/tasas-iva', validar({ query: v.listarQuery }), ctrl.listar('tasasIva'));
router.post('/tasas-iva', validar({ body: v.crearTasaBody }), ctrl.crearTasaIva);
router.patch('/tasas-iva/:id', validar({ params: v.idParams, body: v.actualizarTasaBody }), ctrl.actualizarTasaIva);

router.get('/config', ctrl.obtenerConfig);
router.patch('/config', validar({ body: v.actualizarConfigBody }), ctrl.actualizarConfig);

export default { ruta: '/catalogo', router, publico: false };