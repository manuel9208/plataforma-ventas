import { apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/reportes/opciones');
export const ventas = (query) => apiFetch('/reportes/ventas', { query });
export const estadisticas = (query) => apiFetch('/reportes/ventas/estadisticas', { query });
export const consumo = (query) => apiFetch('/reportes/ventas/consumo', { query });
export const detalleVenta = (id) => apiFetch(`/reportes/ventas/${id}`);