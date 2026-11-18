import { apiFetch } from '../utils/apiFetch.js';

export const listar = () => apiFetch('/movimientos');
export const crear = (datos) => apiFetch('/movimientos', { metodo: 'POST', cuerpo: datos });
export const anular = (id, datos) => apiFetch(`/movimientos/${id}/anulacion`, { metodo: 'POST', cuerpo: datos });