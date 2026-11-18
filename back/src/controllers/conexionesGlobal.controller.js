import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/conexionesGlobal.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.datos.params.id, req.datos.query.sucursalId));
});

export const guardar = asyncHandler(async (req, res) => {
  const { id, grupo } = req.datos.params;
  res.json(await servicio.guardarGrupo(req.usuario, id, grupo, req.datos.query.sucursalId, req.datos.body.valores, req.ip));
});

export const quitar = asyncHandler(async (req, res) => {
  const { id, grupo } = req.datos.params;
  res.json(await servicio.quitarGrupoDeSucursal(req.usuario, id, grupo, req.datos.query.sucursalId, req.ip));
});

export const revelar = asyncHandler(async (req, res) => {
  res.json(await servicio.revelar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});