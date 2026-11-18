import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/cajas/opciones');
export const listar = (query) => apiFetch('/cajas', { query });
export const usuarios = (sucursalId) => apiFetch('/cajas/usuarios', { query: { sucursalId } });
export const crear = (datos) => apiFetch('/cajas', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/cajas/${id}`, { metodo: 'PATCH', cuerpo: datos });
// datos: { usuarioId, cajaId }  (cajaId null = quitar la caja)
export const asignar = (datos) => apiFetch('/cajas/asignaciones', { metodo: 'PUT', cuerpo: datos });