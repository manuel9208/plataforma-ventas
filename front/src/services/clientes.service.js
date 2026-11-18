import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/clientes', { query });
export const obtener = (id) => apiFetch(`/clientes/${id}`);
export const crear = (datos) => apiFetch('/clientes', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/clientes/${id}`, { metodo: 'PATCH', cuerpo: datos });