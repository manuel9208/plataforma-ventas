import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { idParams, listarQuery, crearBody, actualizarBody } from '../validators/usuarios.validator.js';
import * as ctrl from '../controllers/usuarios.controller.js';

const router = Router();

// Solo administración, y con el permiso del módulo
router.use(
  requerirRol(['administrador', 'gerente']),
  requerirPermiso('pantalla.admin'),
  requerirPermiso('empleados.gestionar')
);

router.get('/opciones', ctrl.opciones);
router.get('/', validar({ query: listarQuery }), ctrl.listar);
router.post('/', validar({ body: crearBody }), ctrl.crear);
router.get('/:id', validar({ params: idParams }), ctrl.obtener);
router.patch('/:id', validar({ params: idParams, body: actualizarBody }), ctrl.actualizar);
router.delete('/:id', validar({ params: idParams }), ctrl.desactivar);

export default { ruta: '/usuarios', router, publico: false };