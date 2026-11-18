import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/usuarios/opciones');
export const listar = (query) => apiFetch('/usuarios', { query });
export const crear = (datos) => apiFetch('/usuarios', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/usuarios/${id}`, { metodo: 'PATCH', cuerpo: datos });