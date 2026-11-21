import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/clientes', { query });
export const obtener = (id) => apiFetch(`/clientes/${id}`);
export const crear = (datos) => apiFetch('/clientes', { metodo: 'POST', cuerpo: datos });
export const actualizar = (id, datos) => apiFetch(`/clientes/${id}`, { metodo: 'PATCH', cuerpo: datos });

export const articulos = (id) => apiFetch(`/clientes/${id}/articulos`);
export const bajaArticulo = (id, articuloId, motivo) =>
  apiFetch(`/clientes/${id}/articulos/${articuloId}/baja`, { metodo: 'POST', cuerpo: { motivo } });

export const generarPin = (id) => apiFetch(`/clientes/${id}/pin`, { metodo: 'POST', cuerpo: {} });

export const puntos = (id) => apiFetch(`/clientes/${id}/puntos`);
export const ajustarPuntos = (id, cuerpo) => apiFetch(`/clientes/${id}/puntos/ajustes`, { metodo: 'POST', cuerpo });