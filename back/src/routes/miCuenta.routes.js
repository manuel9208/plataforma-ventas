import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { autenticarCliente } from '../middlewares/autenticarCliente.js';
import { loginBody, datosBody, cambiarPinBody } from '../validators/miCuenta.validator.js';
import * as ctrl from '../controllers/miCuenta.controller.js';

const router = Router();

// Solo /login es abierta. Todo lo demás exige la sesión del cliente (llave propia, distinta a la de empleados).
router.post('/login', validar({ body: loginBody }), ctrl.login);
router.get('/yo', autenticarCliente, ctrl.yo);
router.get('/pedidos', autenticarCliente, ctrl.pedidos);
router.get('/compras', autenticarCliente, ctrl.compras);
router.get('/cupones', autenticarCliente, ctrl.cupones);
router.get('/puntos', autenticarCliente, ctrl.puntos);
router.patch('/datos', autenticarCliente, validar({ body: datosBody }), ctrl.actualizarDatos);
router.post('/pin', autenticarCliente, validar({ body: cambiarPinBody }), ctrl.cambiarPin);
router.post('/aviso-privacidad', autenticarCliente, ctrl.aceptarAviso);

// publico: true salta la sesión de empleados; la empresa se sigue identificando con el encabezado
export default { ruta: '/mi-cuenta', router, publico: true };