const BASE = import.meta.env.VITE_API_URL;
const SLUG = import.meta.env.VITE_EMPRESA_SLUG;

// Cada tipo de sesión guarda su token con su propia clave: la del cliente nunca se mezcla con la del empleado
export const CLAVE_TOKEN = { empleado: 'token', cliente: 'token_cliente' };

const alExpirar = { empleado: () => {}, cliente: () => {} };
export const configurarAlExpirar = (fn) => {
  alExpirar.empleado = fn;
};
export const configurarAlExpirarCliente = (fn) => {
  alExpirar.cliente = fn;
};

export class ErrorApi extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// sesion: 'empleado' (por defecto) o 'cliente'
export async function apiFetch(ruta, { metodo = 'GET', cuerpo, query, sesion = 'empleado' } = {}) {
  const url = new URL(BASE + ruta);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const token = localStorage.getItem(CLAVE_TOKEN[sesion]);
  const headers = { 'X-Empresa-Slug': SLUG };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor');
  }

  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) alExpirar[sesion]();
    throw new ErrorApi(res.status, datos?.error || 'Error inesperado', datos?.detalles);
  }
  return datos;
}

// Descarga un archivo (PDF, Excel…) que arma el servidor y lo guarda en el equipo.
// El nombre se arma en la pantalla: no hace falta leer cabeceras del servidor.
export async function apiDescargar(ruta, { query, nombre = 'descarga' } = {}) {
  const url = new URL(BASE + ruta);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const token = localStorage.getItem('token');
  const headers = { 'X-Empresa-Slug': SLUG };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor');
  }
  if (!res.ok) {
    const datos = await res.json().catch(() => null);
    throw new ErrorApi(res.status, datos?.error || 'No se pudo generar el archivo', datos?.detalles);
  }

  const direccion = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(direccion), 10000);
}