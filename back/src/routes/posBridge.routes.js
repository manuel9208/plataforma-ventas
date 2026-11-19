import { Router } from 'express';
import * as ctrl from '../controllers/posBridge.controller.js';

const router = Router();

// Pública y sin empresa: el instalador de Windows no manda cabeceras de empresa ni token.
// Solo entrega el programa de impresión (sin datos ni claves).
router.get('/version', ctrl.version);
router.get('/pos-bridge.ps1', ctrl.programa);
router.get('/instalar.ps1', ctrl.instalador);

export default { ruta: '/pos-bridge', router, publico: true, sinTenant: true };