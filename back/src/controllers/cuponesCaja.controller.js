import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cuponesCaja.service.js';

export const consultar = asyncHandler(async (req, res) => {
  res.json(await servicio.consultarCupon(req.usuario, req.datos.query));
});