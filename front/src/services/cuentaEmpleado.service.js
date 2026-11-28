import { apiFetch } from '../utils/apiFetch.js';

export const obtener = () => apiFetch('/cuenta-empleado');
export const cambiarPassword = (datos) => apiFetch('/cuenta-empleado/password', { metodo: 'PUT', cuerpo: datos });
export const cambiarPin = (datos) => apiFetch('/cuenta-empleado/pin', { metodo: 'PUT', cuerpo: datos });