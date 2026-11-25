import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/adiciones.service.js';

export const agregar = asyncHandler(async (req, res) => {
  const r = await servicio.agregar(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.adicion.repetida ? 200 : 201).json(r);
});