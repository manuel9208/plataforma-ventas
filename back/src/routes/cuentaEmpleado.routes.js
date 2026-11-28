import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { passwordBody, pinBody } from '../validators/cuentaEmpleado.validator.js';
import * as ctrl from '../controllers/cuentaEmpleado.controller.js';

const router = Router();

// Cualquier empleado con sesión, sobre SU propia cuenta (el id sale de la sesión, nunca de la URL)
router.get('/', ctrl.ver);
router.put('/password', validar({ body: passwordBody }), ctrl.cambiarPassword);
router.put('/pin', validar({ body: pinBody }), ctrl.cambiarPin);

export default { ruta: '/cuenta-empleado', router, publico: false };