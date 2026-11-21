import { Router } from 'express';
import { validar } from '../middlewares/validar.js';
import { requerirPermiso } from '../middlewares/requerirPermiso.js';
import { idParams, listarQuery, crearBody, actualizarBody, articuloParams, bajaArticuloBody } from '../validators/clientes.validator.js';
import * as ctrl from '../controllers/clientes.controller.js';
import * as ctrlPuntos from '../controllers/puntos.controller.js';
import { ajustePuntosBody } from '../validators/puntos.validator.js';

const router = Router();

// Sin restricción de rol: los cajeros buscan y registran clientes desde Caja
router.use(requerirPermiso('clientes.gestionar'));

router.get('/', validar({ query: listarQuery }), ctrl.listar);
router.post('/', validar({ body: crearBody }), ctrl.crear);
router.get('/:id', validar({ params: idParams }), ctrl.obtener);
router.get('/:id/articulos', validar({ params: idParams }), ctrl.listarArticulos);
router.post('/:id/articulos/:articuloId/baja', validar({ params: articuloParams, body: bajaArticuloBody }), ctrl.bajaArticulo);
router.patch('/:id', validar({ params: idParams, body: actualizarBody }), ctrl.actualizar);
router.get('/:id/puntos', validar({ params: idParams }), ctrlPuntos.ver);
router.post('/:id/puntos/ajustes', requerirPermiso('puntos.ajustar'), validar({ params: idParams, body: ajustePuntosBody }), ctrlPuntos.ajustar);
router.post('/:id/pin', validar({ params: idParams }), ctrl.generarPin);

export default { ruta: '/clientes', router, publico: false };