import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/publico.service.js';

export const sucursales = asyncHandler(async (req, res) => {
  res.json(await servicio.listarSucursales(req.empresa));
});

export const catalogo = asyncHandler(async (req, res) => {
  res.json(await servicio.catalogo(req.empresa, req.datos.query));
});