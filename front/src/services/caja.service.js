import { apiFetch } from '../utils/apiFetch.js';

export const catalogo = (query) => apiFetch('/caja/catalogo', { query });
export const escanear = (codigo) => apiFetch('/caja/escanear', { query: { codigo } });
export const configuracion = () => apiFetch('/caja/configuracion');
export const servicios = (query) => apiFetch('/caja/servicios', { query });
export const sugerencias = (campo, buscar) => apiFetch('/caja/sugerencias', { query: { campo, buscar } });
export const crearVenta = (datos) => apiFetch('/caja/ventas', { metodo: 'POST', cuerpo: datos });
export const promociones = () => apiFetch('/caja/promociones');
// Para buscar clientes se reutiliza la API de clientes
export { listar as buscarClientes } from './clientes.service.js';
export const canje = (clienteId) => apiFetch('/caja/canje', { query: { clienteId } });