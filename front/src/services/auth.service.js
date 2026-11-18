import { apiFetch } from '../utils/apiFetch.js';

export const login = (telefono, password) =>
  apiFetch('/auth/login', { metodo: 'POST', cuerpo: { telefono, password } });

export const yo = () => apiFetch('/auth/yo');