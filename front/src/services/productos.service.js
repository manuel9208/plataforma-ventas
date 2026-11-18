import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/productos/opciones');
export const listar = (query) => apiFetch('/productos', { query });
export const obtener = (id) => apiFetch(`/productos/${id}`);
export const crear = (datos) => apiFetch('/productos', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/productos/${id}`, { metodo: 'PATCH', cuerpo: datos });