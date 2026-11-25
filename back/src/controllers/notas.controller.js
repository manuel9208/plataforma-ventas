import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/notas.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.params.id));
});

export const cobrar = asyncHandler(async (req, res) => {
  const r = await servicio.cobrar(req.usuario, req.datos.params.id, req.datos.body, req.ip);
  res.status(r.repetido ? 200 : 201).json(r);
});

export const copia = asyncHandler(async (req, res) => {
  res.json(await servicio.copia(req.usuario, req.datos.params.id, req.ip));
});

export const cambiarEstado = asyncHandler(async (req, res) => {
  res.json(await servicio.cambiarEstado(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const corregir = asyncHandler(async (req, res) => {
  res.json(await servicio.corregir(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const cotizar = asyncHandler(async (req, res) => {
  res.json(await servicio.cotizar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});