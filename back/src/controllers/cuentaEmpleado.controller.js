import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cuentaEmpleado.service.js';

// Solo HTTP: el empleado siempre sale de la sesión (req.usuario), nunca de la URL ni del body
export const ver = asyncHandler(async (req, res) => {
  res.json(await servicio.ver(req.usuario));
});

export const cambiarPassword = asyncHandler(async (req, res) => {
  res.json(await servicio.cambiarPassword(req.usuario, req.datos.body, req.ip));
});

export const cambiarPin = asyncHandler(async (req, res) => {
  res.json(await servicio.cambiarPin(req.usuario, req.datos.body, req.ip));
});