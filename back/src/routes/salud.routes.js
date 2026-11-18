import { Router } from 'express';
import { obtenerSalud } from '../controllers/salud.controller.js';

const router = Router();
router.get('/', obtenerSalud);

export default { ruta: '/salud', router, publico: true, sinTenant: true };