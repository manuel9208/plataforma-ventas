import { apiDescargar, apiFetch } from '../utils/apiFetch.js';

export const opciones = () => apiFetch('/reportes/opciones');
export const ventas = (query) => apiFetch('/reportes/ventas', { query });
export const estadisticas = (query) => apiFetch('/reportes/ventas/estadisticas', { query });
export const consumo = (query) => apiFetch('/reportes/ventas/consumo', { query });
export const detalleVenta = (id) => apiFetch(`/reportes/ventas/${id}`);
export const analisis = (query) => apiFetch('/reportes/ventas/analisis', { query });
export const cobrosAnteriores = (query) => apiFetch('/reportes/ventas/cobros-anteriores', { query });

const EXTENSION = { pdf: 'pdf', excel: 'xlsx' };

export const exportar = (formato, query) =>
  apiDescargar(`/reportes/ventas/exportar/${formato}`, {
    query,
    nombre: `reporte-ventas_${query.desde}_${query.hasta}.${EXTENSION[formato]}`,
  });