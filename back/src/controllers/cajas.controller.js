import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/cajas.service.js';

export const opciones = asyncHandler(async (req, res) => {
  res.json(await servicio.obtenerOpciones(req.usuario));
});

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const usuarios = asyncHandler(async (req, res) => {
  res.json(await servicio.listarUsuarios(req.usuario, req.datos.query.sucursalId));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.body, req.ip));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const asignar = asyncHandler(async (req, res) => {
  res.json(await servicio.asignar(req.usuario, req.datos.body, req.ip));
});