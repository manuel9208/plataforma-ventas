import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/ventasMostrador.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.params.id));
});

export const copia = asyncHandler(async (req, res) => {
  res.json(await servicio.copia(req.usuario, req.datos.params.id, req.ip));
});

export const devolver = asyncHandler(async (req, res) => {
  const r = await servicio.devolver(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.repetido ? 200 : 201).json(r);
});