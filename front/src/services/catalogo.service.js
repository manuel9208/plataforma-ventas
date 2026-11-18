import { apiFetch } from '../utils/apiFetch.js';

// entidad: 'departamentos' | 'tipos-articulo' | 'tasas-iva'
export const listar = (entidad, query) => apiFetch(`/catalogo/${entidad}`, { query });
export const crear = (entidad, datos) => apiFetch(`/catalogo/${entidad}`, { metodo: 'POST', cuerpo: datos });
export const actualizar = (entidad, id, datos) =>
  apiFetch(`/catalogo/${entidad}/${id}`, { metodo: 'PATCH', cuerpo: datos });

export const obtenerConfig = () => apiFetch('/catalogo/config');
export const actualizarConfig = (datos) => apiFetch('/catalogo/config', { metodo: 'PATCH', cuerpo: datos });