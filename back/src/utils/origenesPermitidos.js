import { pool } from '../config/db.js';
import { env } from '../config/env.js';

const VIGENCIA_MS = 60_000;
let cache = { hasta: 0, origenes: new Set() };

// "app.cliente.com" o "https://app.cliente.com/loquesea" -> "https://app.cliente.com". Si no sirve, devuelve "".
export function normalizarOrigen(texto) {
  try {
    const t = String(texto ?? '').trim();
    if (!t) return '';
    const url = new URL(t.includes('://') ? t : `https://${t}`);
    const local = url.hostname === 'localhost';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return '';
    if (!local && !url.hostname.includes('.')) return '';
    return url.origin.toLowerCase();
  } catch {
    return '';
  }
}

async function cargar() {
  if (Date.now() < cache.hasta) return cache.origenes;
  // empresas es una tabla global: aquí se leen los dominios de todas (también de las suspendidas, para que vean su aviso)
  const r = await pool.query(`SELECT unnest(dominios_permitidos) AS dominio FROM empresas`);
  const origenes = new Set(env.CORS_ORIGINS.map(normalizarOrigen).filter(Boolean));
  for (const f of r.rows) {
    const o = normalizarOrigen(f.dominio);
    if (o) origenes.add(o);
  }
  cache = { hasta: Date.now() + VIGENCIA_MS, origenes };
  return origenes;
}

// Para el cors del servidor: sin Origin (herramientas, mismo sitio) pasa; con Origin debe estar en la lista
export async function origenPermitido(origin) {
  if (!origin) return true;
  return (await cargar()).has(origin.toLowerCase());
}

// Se llama al cambiar dominios para que se noten de inmediato
export function olvidarOrigenes() {
  cache = { hasta: 0, origenes: new Set() };
}