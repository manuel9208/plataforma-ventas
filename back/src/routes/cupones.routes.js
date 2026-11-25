import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { requerirModulo } from '../middlewares/requerirModulo.js';
import { bajaBody, cuponBody, cuponEdicionBody, encendidoBody, idParams, listaQuery } from '../validators/cupones.validator.js';
import * as ctrl from '../controllers/cupones.controller.js';

const router = Router();

// Igual que Promociones: administrador o gerente, con el permiso de la pantalla, el del módulo y el candado comercial
router.use(
  requerirRol(['adminglobal', 'administrador', 'gerente']),
  requerirPermiso('pantalla.admin'),
  requerirModulo('promociones'),
  requerirPermiso('promociones.gestionar')
);

router.get('/', validar({ query: listaQuery }), ctrl.listar);
router.get('/opciones', ctrl.opciones);
router.get('/:id', validar({ params: idParams }), ctrl.obtener);
router.post('/', validar({ body: cuponBody }), ctrl.crear);
router.put('/:id', validar({ params: idParams, body: cuponEdicionBody }), ctrl.actualizar);
router.patch('/:id/encendido', validar({ params: idParams, body: encendidoBody }), ctrl.encender);
router.post('/:id/baja', validar({ params: idParams, body: bajaBody }), ctrl.baja);

export default { ruta: '/cupones', router, publico: false };