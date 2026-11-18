import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/entregas.service.js';

export const entregar = asyncHandler(async (req, res) => {
  const r = await servicio.entregar(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.repetida ? 200 : 201).json(r);
});