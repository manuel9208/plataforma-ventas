import { apiFetch } from '../utils/apiFetch.js';

const cliente = { sesion: 'cliente' };

export const login = (telefono, pin) => apiFetch('/mi-cuenta/login', { metodo: 'POST', cuerpo: { telefono, pin }, ...cliente });
export const yo = () => apiFetch('/mi-cuenta/yo', cliente);
export const pedidos = () => apiFetch('/mi-cuenta/pedidos', cliente);
export const compras = () => apiFetch('/mi-cuenta/compras', cliente);
export const actualizarDatos = (cuerpo) => apiFetch('/mi-cuenta/datos', { metodo: 'PATCH', cuerpo, ...cliente });
export const cambiarPin = (cuerpo) => apiFetch('/mi-cuenta/pin', { metodo: 'POST', cuerpo, ...cliente });
export const aceptarAviso = () => apiFetch('/mi-cuenta/aviso-privacidad', { metodo: 'POST', ...cliente });
export const puntos = () => apiFetch('/mi-cuenta/puntos', cliente);