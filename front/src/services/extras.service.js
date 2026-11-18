import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/extras/opciones');
export const listar = (query) => apiFetch('/extras', { query });
export const obtener = (id) => apiFetch(`/extras/${id}`);
export const crear = (datos) => apiFetch('/extras', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/extras/${id}`, { metodo: 'PATCH', cuerpo: datos });