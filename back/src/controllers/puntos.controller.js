import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/puntos.service.js';

export const ver = asyncHandler(async (req, res) => {
  res.json(await servicio.resumenStaff(req.usuario, req.datos.params.id));
});

export const ajustar = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.ajustar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});