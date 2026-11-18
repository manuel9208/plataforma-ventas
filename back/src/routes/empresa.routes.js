import { Router } from 'express';
import * as ctrl from '../controllers/empresa.controller.js';

const router = Router();
router.get('/', ctrl.obtener);

export default { ruta: '/empresa', router, publico: true };