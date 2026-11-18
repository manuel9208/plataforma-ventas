import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cajaPromociones.service.js';

export const vigentes = asyncHandler(async (req, res) => {
  res.json(await servicio.vigentes(req.usuario));
});