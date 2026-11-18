import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/promociones', { query });
export const opciones = () => apiFetch('/promociones/opciones');
export const buscar = (tipo, texto) => apiFetch('/promociones/buscar', { query: { tipo, buscar: texto } });
export const obtener = (id) => apiFetch(`/promociones/${id}`);
export const crear = (datos) => apiFetch('/promociones', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/promociones/${id}`, { metodo: 'PUT', cuerpo: datos });
export const encender = (id, encendida) => apiFetch(`/promociones/${id}/encendida`, { metodo: 'PATCH', cuerpo: { encendida } });
export const baja = (id, motivo) => apiFetch(`/promociones/${id}/baja`, { metodo: 'POST', cuerpo: { motivo } });