import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Una llave distinta por tipo de token: uno de "empleado" nunca vale como "cliente"
const llaves = {};
function llave(dominio) {
  llaves[dominio] ??= crypto.createHmac('sha256', env.SESSION_SECRET).update('token:' + dominio).digest();
  return llaves[dominio];
}

const firmar = (dominio, cuerpo) =>
  crypto.createHmac('sha256', llave(dominio)).update(cuerpo).digest();

export function firmarToken(dominio, payload, duracionSegundos) {
  const exp = Math.floor(Date.now() / 1000) + duracionSegundos;
  const cuerpo = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  return `${cuerpo}.${firmar(dominio, cuerpo).toString('base64url')}`;
}

export function verificarToken(dominio, token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;

  const esperada = firmar(dominio, cuerpo);
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}