import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { requerirModulo } from '../middlewares/requerirModulo.js';
import { bajaBody, buscarQuery, encendidaBody, idParams, listaQuery, promocionBody } from '../validators/promociones.validator.js';
import * as ctrl from '../controllers/promociones.controller.js';

const router = Router();

// Administrador o gerente, con el permiso de la pantalla y el del módulo, y el candado comercial [1]
router.use(
  requerirRol(['adminglobal', 'administrador', 'gerente']),
  requerirPermiso('pantalla.admin'),
  requerirModulo('promociones'),
  requerirPermiso('promociones.gestionar')
);

router.get('/', validar({ query: listaQuery }), ctrl.listar);
router.get('/opciones', ctrl.opciones);
router.get('/buscar', validar({ query: buscarQuery }), ctrl.buscar);
router.get('/:id', validar({ params: idParams }), ctrl.obtener);
router.post('/', validar({ body: promocionBody }), ctrl.crear);
router.put('/:id', validar({ params: idParams, body: promocionBody }), ctrl.actualizar);
router.patch('/:id/encendida', validar({ params: idParams, body: encendidaBody }), ctrl.encender);
router.post('/:id/baja', validar({ params: idParams, body: bajaBody }), ctrl.baja);

export default { ruta: '/promociones', router, publico: false };