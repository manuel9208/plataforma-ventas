import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/ajustes.service.js';

export const cancelar = asyncHandler(async (req, res) => {
  const r = await servicio.cancelar(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.repetido ? 200 : 201).json(r);
});

export const reembolsar = asyncHandler(async (req, res) => {
  const r = await servicio.reembolsar(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.repetido ? 200 : 201).json(r);
});