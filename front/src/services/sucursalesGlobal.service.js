import { apiFetch } from '../utils/apiFetch.js';

const base = (empresaId) => `/global/empresas/${empresaId}/sucursales`;

export const listar = (empresaId) => apiFetch(base(empresaId));
export const crear = (empresaId, datos) => apiFetch(base(empresaId), { metodo: 'POST', cuerpo: datos });
export const editar = (empresaId, id, datos) => apiFetch(`${base(empresaId)}/${id}`, { metodo: 'PATCH', cuerpo: datos });
export const darDeBaja = (empresaId, id, motivo) => apiFetch(`${base(empresaId)}/${id}/baja`, { metodo: 'POST', cuerpo: { motivo } });
export const reactivar = (empresaId, id) => apiFetch(`${base(empresaId)}/${id}/baja`, { metodo: 'DELETE' });