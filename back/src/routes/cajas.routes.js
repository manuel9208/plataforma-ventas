import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { idParams, listarQuery, usuariosQuery, crearBody, actualizarBody, asignarBody } from '../validators/cajas.validator.js';
import * as ctrl from '../controllers/cajas.controller.js';

const router = Router();

router.use(
  requerirRol(['administrador', 'gerente']),
  requerirPermiso('pantalla.admin'),
  requerirPermiso('caja.administrar')
);

router.get('/opciones', ctrl.opciones);
router.get('/usuarios', validar({ query: usuariosQuery }), ctrl.usuarios);
router.get('/', validar({ query: listarQuery }), ctrl.listar);
router.post('/', validar({ body: crearBody }), ctrl.crear);
router.put('/asignaciones', validar({ body: asignarBody }), ctrl.asignar);
router.patch('/:id', validar({ params: idParams, body: actualizarBody }), ctrl.actualizar);

export default { ruta: '/cajas', router, publico: false };