import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { autenticar } from '../middlewares/autenticar.js';
import { loginBody } from '../validators/auth.validator.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();
router.post('/login', validar({ body: loginBody }), ctrl.login);
router.get('/yo', autenticar, ctrl.yo);

// publico: true solo salta autenticar a nivel de archivo; /yo lo pide por su cuenta
export default { ruta: '/auth', router, publico: true };