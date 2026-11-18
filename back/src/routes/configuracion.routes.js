import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { alcanceQuery, paramsSucursal, guardarAjustesBody, sucursalBody } from '../validators/configuracion.validator.js';
import * as ctrl from '../controllers/configuracion.controller.js';

const router = Router();

// Igual que Catálogo [105]: administrador o gerente, con el permiso de la pantalla y el del módulo
router.use(requerirRol(['adminglobal', 'administrador', 'gerente']), requerirPermiso('pantalla.admin'), requerirPermiso('configuracion.gestionar'));

router.get('/', validar({ query: alcanceQuery }), ctrl.obtener);
router.patch('/', validar({ query: alcanceQuery, body: guardarAjustesBody }), ctrl.guardar);
router.patch('/sucursal/:id', validar({ params: paramsSucursal, body: sucursalBody }), ctrl.guardarSucursal);

export default { ruta: '/configuracion', router, publico: false };