import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/sucursalesGlobal.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.datos.params.id));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const editar = asyncHandler(async (req, res) => {
  const { id, sid } = req.datos.params;
  res.json(await servicio.editar(req.usuario, id, sid, req.datos.body, req.ip));
});

export const darDeBaja = asyncHandler(async (req, res) => {
  const { id, sid } = req.datos.params;
  res.json(await servicio.darDeBaja(req.usuario, id, sid, req.datos.body.motivo, req.ip));
});

export const reactivar = asyncHandler(async (req, res) => {
  const { id, sid } = req.datos.params;
  res.json(await servicio.reactivar(req.usuario, id, sid, req.ip));
});