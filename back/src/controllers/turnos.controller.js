import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/turnos.service.js';

export const actual = asyncHandler(async (req, res) => {
  res.json(await servicio.estadoActual(req.usuario));
});

export const abrir = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.abrir(req.usuario, req.datos.body, req.ip));
});

export const cerrar = asyncHandler(async (req, res) => {
  res.json(await servicio.cerrar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const abiertos = asyncHandler(async (req, res) => {
  res.json(await servicio.listarAbiertos(req.usuario));
});