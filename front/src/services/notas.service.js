import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/caja/notas', { query });
export const obtener = (id) => apiFetch(`/caja/notas/${id}`);
export const cobrar = (id, datos) => apiFetch(`/caja/notas/${id}/cobros`, { metodo: 'POST', cuerpo: datos });
export const copia = (id) => apiFetch(`/caja/notas/${id}/copia`, { metodo: 'POST' });
export const cambiarEstado = (id, datos) => apiFetch(`/caja/notas/${id}/estado`, { metodo: 'PATCH', cuerpo: datos });
export const entregar = (id, datos) => apiFetch(`/caja/notas/${id}/entregas`, { metodo: 'POST', cuerpo: datos });
export const cancelar = (id, datos) => apiFetch(`/caja/notas/${id}/cancelaciones`, { metodo: 'POST', cuerpo: datos });
export const reembolsar = (id, datos) => apiFetch(`/caja/notas/${id}/reembolsos`, { metodo: 'POST', cuerpo: datos });