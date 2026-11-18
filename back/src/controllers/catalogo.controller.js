import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/catalogo.service.js';

export const listar = (entidad) =>
  asyncHandler(async (req, res) => {
    res.json(await servicio.listar(req.usuario, entidad, req.datos.query));
  });

export const crearDepartamento = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crearDepartamento(req.usuario, req.datos.body, req.ip));
});
export const actualizarDepartamento = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarDepartamento(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const crearTipoArticulo = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crearTipoArticulo(req.usuario, req.datos.body, req.ip));
});
export const actualizarTipoArticulo = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarTipoArticulo(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const crearTasaIva = asyncHandler(async (req, res) => {
  res.status(201).json(await servicio.crearTasaIva(req.usuario, req.datos.body, req.ip));
});
export const actualizarTasaIva = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarTasaIva(req.usuario, req.datos.params.id, req.datos.body, req.ip));
});

export const obtenerConfig = asyncHandler(async (req, res) => {
  res.json(await servicio.obtenerConfiguracion(req.usuario));
});
export const actualizarConfig = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarConfiguracion(req.usuario, req.datos.body, req.ip));
});