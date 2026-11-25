import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/miCuenta.service.js';

export const login = asyncHandler(async (req, res) => {
  res.json(await servicio.iniciarSesion(req.empresa, req.datos.body, req.ip));
});

export const yo = asyncHandler(async (req, res) => {
  res.json(await servicio.perfil(req.cliente));
});

export const pedidos = asyncHandler(async (req, res) => {
  res.json(await servicio.pedidos(req.cliente));
});

export const compras = asyncHandler(async (req, res) => {
  res.json(await servicio.compras(req.cliente));
});

export const actualizarDatos = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarDatos(req.cliente, req.datos.body, req.ip));
});

export const cambiarPin = asyncHandler(async (req, res) => {
  res.json(await servicio.cambiarPin(req.cliente, req.datos.body, req.ip));
});

export const aceptarAviso = asyncHandler(async (req, res) => {
  res.json(await servicio.aceptarAviso(req.cliente, req.ip));
});

export const puntos = asyncHandler(async (req, res) => {
  res.json(await servicio.puntos(req.cliente));
});

export const cupones = asyncHandler(async (req, res) => {
  res.json(await servicio.cupones(req.cliente));
});