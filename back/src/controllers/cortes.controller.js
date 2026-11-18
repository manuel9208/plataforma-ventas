import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cortes.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.params.turnoId));
});

export const enCurso = asyncHandler(async (req, res) => {
  res.json(await servicio.enCurso(req.usuario, req.datos.params.turnoId, req.ip));
});