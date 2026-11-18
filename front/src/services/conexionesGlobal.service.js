import { apiFetch } from '../utils/apiFetch.js';

export const listar = (empresaId, sucursalId) => apiFetch(`/global/conexiones/${empresaId}`, { query: { sucursalId } });
export const guardar = (empresaId, grupo, sucursalId, valores) =>
  apiFetch(`/global/conexiones/${empresaId}/${grupo}`, { metodo: 'PUT', query: { sucursalId }, cuerpo: { valores } });
export const quitar = (empresaId, grupo, sucursalId) =>
  apiFetch(`/global/conexiones/${empresaId}/${grupo}`, { metodo: 'DELETE', query: { sucursalId } });
export const revelar = (empresaId, clave, sucursalId) =>
  apiFetch(`/global/conexiones/${empresaId}/revelar`, { metodo: 'POST', cuerpo: { clave, ...(sucursalId ? { sucursalId } : {}) } });