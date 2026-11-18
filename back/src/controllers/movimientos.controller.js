import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/movimientos.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario));
});

export const crear = asyncHandler(async (req, res) => {
  const r = await servicio.crear(req.usuario, req.datos.body, req.ip);
  res.status(r.repetido ? 200 : 201).json(r);
});

export const anular = asyncHandler(async (req, res) => {
  res.json(await servicio.anular(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});