import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/servicios/opciones');
export const listar = (query) => apiFetch('/servicios', { query });
export const obtener = (id) => apiFetch(`/servicios/${id}`);
export const crear = (datos) => apiFetch('/servicios', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/servicios/${id}`, { metodo: 'PATCH', cuerpo: datos });