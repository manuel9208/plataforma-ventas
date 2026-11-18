import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/promociones.service.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.usuario, req.datos.query));
});

export const opciones = asyncHandler(async (req, res) => {
  res.json(await servicio.opciones(req.usuario));
});

export const buscar = asyncHandler(async (req, res) => {
  res.json(await servicio.buscar(req.usuario, req.datos.query));
});

export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.usuario, req.datos.params.id));
});

export const crear = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario, req.datos.body, req.ip));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizar(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const encender = asyncHandler(async (req, res) => {
  res.json(await servicio.encender(req.usuario, req.datos.params.id, req.datos.body.encendida, req.ip));
});

export const baja = asyncHandler(async (req, res) => {
  res.json(await servicio.darDeBaja(req.usuario, req.datos.params.id, req.datos.body.motivo, req.ip));
});