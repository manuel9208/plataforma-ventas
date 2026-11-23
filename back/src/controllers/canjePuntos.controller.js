import { asyncHandler } from '../utils/asyncHandler.js';
import * as servicio from '../services/canjePuntos.service.js';

// No he visto dónde deja `validar` los datos de la URL: por eso se lee de los dos lugares (ya vienen validados)
export const consultar = asyncHandler(async (req, res) => {
  const clienteId = req.datos?.query?.clienteId ?? req.query.clienteId;
  res.json(await servicio.consultarCanje(req.usuario, clienteId));
});