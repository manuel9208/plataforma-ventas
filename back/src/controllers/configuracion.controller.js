import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/configuracion.service.js';

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.query.sucursalId));
});

export const guardar = asyncHandler(async (req, res) => {
  res.json(await servicio.guardarAjustes(req.usuario, req.datos.query.sucursalId, req.datos.body.valores, req.ip));
});

export const guardarSucursal = asyncHandler(async (req, res) => {
  res.json(await servicio.guardarSucursal(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const cupones = asyncHandler(async (req, res) => {
  res.json(await servicio.cupones(req.cliente));
});