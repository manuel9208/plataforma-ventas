import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/cupones', { query });
export const opciones = () => apiFetch('/cupones/opciones');
export const obtener = (id) => apiFetch(`/cupones/${id}`);
export const crear = (datos) => apiFetch('/cupones', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/cupones/${id}`, { metodo: 'PUT', cuerpo: datos });
export const encender = (id, encendido) => apiFetch(`/cupones/${id}/encendido`, { metodo: 'PATCH', cuerpo: { encendido } });
export const baja = (id, motivo) => apiFetch(`/cupones/${id}/baja`, { metodo: 'POST', cuerpo: { motivo } });