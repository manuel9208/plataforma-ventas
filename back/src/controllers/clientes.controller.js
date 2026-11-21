import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/clientes.service.js';
import * as articulos from '../services/clienteArticulos.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.params.id, req.ip));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.body, req.ip));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const listarArticulos = asyncHandler(async (req, res) => {
  res.json(await articulos.listar(req.usuario, req.datos.params.id));
});

export const bajaArticulo = asyncHandler(async (req, res) => {
  const { id, articuloId } = req.datos.params;
  res.json(await articulos.darDeBaja(req.usuario, id, articuloId, req.datos.body.motivo, req.ip));
});

export const generarPin = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.generarPin(req.usuario, req.datos.params.id, req.ip));
});