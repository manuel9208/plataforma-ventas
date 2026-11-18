import { asyncHandler } from '../utils/asyncHandler.js';
import { iniciarSesion, obtenerPerfil } from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  res.json(await iniciarSesion(req.empresa, req.datos.body, req.ip));
});

export const yo = asyncHandler(async (req, res) => {
  res.json(await obtenerPerfil(req.empresa, req.usuario));
});