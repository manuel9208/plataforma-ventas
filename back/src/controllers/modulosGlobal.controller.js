import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/modulosGlobal.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.datos.params.id));
});

export const guardar = asyncHandler(async (req, res) => {
  const { id, clave } = req.datos.params;
  res.json(await servicio.guardar(req.usuario, id, clave, req.datos.body, req.ip));
});