import { apiFetch } from '../utils/apiFetch.js';

export const sucursales = () => apiFetch('/publico/sucursales');
export const catalogo = (query) => apiFetch('/publico/catalogo', { query });