import { apiFetch } from '../utils/apiFetch.js';

export const obtener = (sucursalId) => apiFetch('/configuracion', { query: { sucursalId } });
export const guardarAjustes = (sucursalId, valores) => apiFetch('/configuracion', { metodo: 'PATCH', query: { sucursalId }, cuerpo: { valores } });
export const guardarSucursal = (id, datos) => apiFetch(`/configuracion/sucursal/${id}`, { metodo: 'PATCH', cuerpo: datos });