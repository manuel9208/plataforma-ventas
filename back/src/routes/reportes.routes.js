import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirRol } from '../middlewares/requerirRol.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { ventasQuery, estadisticasQuery, consumoQuery, analisisQuery, detalleParams, exportarParams, exportarQuery } from '../validators/reportes.validator.js';
import * as ctrl from '../controllers/reportes.controller.js';

const router = Router();

router.use(requerirRol(['administrador', 'gerente']), requerirPermiso('pantalla.admin'), requerirPermiso('reportes.ver'));

router.get('/opciones', ctrl.opciones);
router.get('/ventas', validar({ query: ventasQuery }), ctrl.verVentas);
router.get('/ventas/estadisticas', validar({ query: estadisticasQuery }), ctrl.verEstadisticas);
router.get('/ventas/consumo', validar({ query: consumoQuery }), ctrl.verConsumo);
router.get('/ventas/analisis', validar({ query: analisisQuery }), ctrl.verAnalisis);
router.get('/ventas/exportar/:formato', validar({ params: exportarParams, query: exportarQuery }), ctrl.exportarVentasArchivo);
router.get('/ventas/:id', validar({ params: detalleParams }), ctrl.verDetalle);

// Cada reporte nuevo = una ruta aquí, su service y su repository
export default { ruta: '/reportes', router, publico: false };