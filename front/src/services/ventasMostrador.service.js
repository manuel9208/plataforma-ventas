import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/caja/ventas', { query });
export const obtener = (id) => apiFetch(`/caja/ventas/${id}`);
export const copia = (id) => apiFetch(`/caja/ventas/${id}/copia`, { metodo: 'POST' });
export const devolver = (id, datos) => apiFetch(`/caja/ventas/${id}/devoluciones`, { metodo: 'POST', cuerpo: datos });