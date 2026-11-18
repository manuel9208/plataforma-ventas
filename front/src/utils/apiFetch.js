const BASE = import.meta.env.VITE_API_URL;
const SLUG = import.meta.env.VITE_EMPRESA_SLUG;

let alExpirar = () => {};
export const configurarAlExpirar = (fn) => {
  alExpirar = fn;
};

export class ErrorApi extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

export async function apiFetch(ruta, { metodo = 'GET', cuerpo, query } = {}) {
  const url = new URL(BASE + ruta);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const token = localStorage.getItem('token');
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
    if (res.status === 401 && token) alExpirar();
    throw new ErrorApi(res.status, datos?.error || 'Error inesperado', datos?.detalles);
  }
  return datos;
}