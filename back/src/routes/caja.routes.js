import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { catalogoQuery, escanearQuery, sugerenciasQuery, crearVentaBody } from '../validators/ventas.validator.js';
import { idParams, listaQuery, cobrarBody, estadoBody, correccionBody } from '../validators/notas.validator.js';
import * as ctrl from '../controllers/caja.controller.js';
import * as ctrlServicios from '../controllers/cajaServicios.controller.js';
import * as ctrlNotas from '../controllers/notas.controller.js';
import { ventasListaQuery, devolverBody } from '../validators/ventasMostrador.validator.js';
import * as ctrlVentas from '../controllers/ventasMostrador.controller.js';
import { entregarBody } from '../validators/entregas.validator.js';
import * as ctrlEntregas from '../controllers/entregas.controller.js';
import { cancelarBody, reembolsarBody } from '../validators/ajustes.validator.js';
import * as ctrlAjustes from '../controllers/ajustes.controller.js';
import * as ctrlPromos from '../controllers/cajaPromociones.controller.js';

const router = Router();

router.use(requerirPermiso('pantalla.caja'));

router.get('/catalogo', validar({ query: catalogoQuery }), ctrl.verCatalogo);
router.get('/escanear', validar({ query: escanearQuery }), ctrl.escanear);
router.get('/configuracion', ctrlServicios.configuracion);
router.get('/servicios', validar({ query: catalogoQuery }), ctrlServicios.servicios);
router.get('/sugerencias', validar({ query: sugerenciasQuery }), ctrlServicios.sugerencias);
router.get('/promociones', ctrlPromos.vigentes);
router.post('/ventas', validar({ body: crearVentaBody }), ctrl.crearVenta);
router.get('/ventas', validar({ query: ventasListaQuery }), ctrlVentas.listar);
router.get('/ventas/:id', validar({ params: idParams }), ctrlVentas.obtener);
router.post('/ventas/:id/copia', validar({ params: idParams }), ctrlVentas.copia);
router.post('/ventas/:id/devoluciones', validar({ params: idParams, body: devolverBody }), ctrlVentas.devolver);

router.get('/notas', validar({ query: listaQuery }), ctrlNotas.listar);
router.get('/notas/:id', validar({ params: idParams }), ctrlNotas.obtener);
router.post('/notas/:id/cobros', validar({ params: idParams, body: cobrarBody }), ctrlNotas.cobrar);
router.post('/notas/:id/copia', validar({ params: idParams }), ctrlNotas.copia);
router.patch('/notas/:id/estado', validar({ params: idParams, body: estadoBody }), ctrlNotas.cambiarEstado);
router.patch('/notas/:id/correccion', validar({ params: idParams, body: correccionBody }), ctrlNotas.corregir);
router.post('/notas/:id/entregas', validar({ params: idParams, body: entregarBody }), ctrlEntregas.entregar);
router.post('/notas/:id/cancelaciones', validar({ params: idParams, body: cancelarBody }), ctrlAjustes.cancelar);
router.post('/notas/:id/reembolsos', validar({ params: idParams, body: reembolsarBody }), ctrlAjustes.reembolsar);

export default { ruta: '/caja', router, publico: false };