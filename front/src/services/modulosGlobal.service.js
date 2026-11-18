import { apiFetch } from '../utils/apiFetch.js';

export const listar = (empresaId) => apiFetch(`/global/modulos/${empresaId}`);
export const guardar = (empresaId, clave, datos) => apiFetch(`/global/modulos/${empresaId}/${clave}`, { metodo: 'PUT', cuerpo: datos });