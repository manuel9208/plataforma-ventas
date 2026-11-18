import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/global/empresas', { query });
export const crear = (datos) => apiFetch('/global/empresas', { metodo: 'POST', cuerpo: datos });
export const editar = (id, datos) => apiFetch(`/global/empresas/${id}`, { metodo: 'PATCH', cuerpo: datos });
export const suspender = (id, motivo) => apiFetch(`/global/empresas/${id}/suspension`, { metodo: 'POST', cuerpo: { motivo } });
export const reactivar = (id) => apiFetch(`/global/empresas/${id}/suspension`, { metodo: 'DELETE' });