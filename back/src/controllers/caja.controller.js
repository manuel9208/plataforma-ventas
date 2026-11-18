import { asyncHandler } from '../utils/asyncHandler.js';
import * as catalogo from '../services/cajaCatalogo.service.js';
import * as ventas from '../services/ventas.service.js';

export const verCatalogo = asyncHandler(async (req, res) => {
  res.json(await catalogo.catalogo(req.usuario, req.datos.query));
});

export const escanear = asyncHandler(async (req, res) => {
  res.json(await catalogo.escanear(req.usuario, req.datos.query.codigo));
});

export const crearVenta = asyncHandler(async (req, res) => {
  const v = await ventas.crear(req.usuario, req.datos.body, req.ip);
  res.status(v.repetida ? 200 : 201).json(v);
});