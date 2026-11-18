import { apiFetch } from '../utils/apiFetch.js';

export const listar = (query) => apiFetch('/cortes', { query });
export const obtener = (turnoId) => apiFetch(`/cortes/${turnoId}`);
export const obtenerEnCurso = (turnoId) => apiFetch(`/cortes/en-curso/${turnoId}`);