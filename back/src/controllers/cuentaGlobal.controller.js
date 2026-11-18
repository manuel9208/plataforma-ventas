import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cuentaGlobal.service.js';

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizar(req.usuario, req.datos.body));
});