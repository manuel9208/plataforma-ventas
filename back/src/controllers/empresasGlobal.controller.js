import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/empresasGlobal.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.datos.query));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.body, req.ip));
});

export const editar = asyncHandler(async (req, res) => {
  res.json(await servicio.editar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const suspender = asyncHandler(async (req, res) => {
  res.json(await servicio.suspender(req.usuario, req.datos.params.id, req.datos.body.motivo, req.ip));
});

export const reactivar = asyncHandler(async (req, res) => {
  res.json(await servicio.reactivar(req.usuario, req.datos.params.id, req.ip));
});