import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cajaServicios.service.js';

export const configuracion = asyncHandler(async (req, res) => {
  res.json(await servicio.configuracion(req.usuario));
});

export const servicios = asyncHandler(async (req, res) => {
  res.json(await servicio.servicios(req.usuario, req.empresa, req.datos.query));
});

export const sugerencias = asyncHandler(async (req, res) => {
  res.json(await servicio.sugerencias(req.usuario, req.datos.query));
});