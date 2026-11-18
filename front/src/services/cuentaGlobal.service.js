import { apiFetch } from '../utils/apiFetch.js';

export const obtener = () => apiFetch('/global/cuenta');
export const actualizar = (datos) => apiFetch('/global/cuenta', { metodo: 'PATCH', cuerpo: datos });