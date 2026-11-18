import crypto from 'node:crypto';
import { env } from '../config/env.js';

const LLAVE = Buffer.from(env.MASTER_KEY, 'hex');

export function cifrar(textoPlano) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', LLAVE, iv);
  const datos = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, datos].map((b) => b.toString('base64')).join('.');
}

export function descifrar(textoCifrado) {
  const [iv, tag, datos] = textoCifrado.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', LLAVE, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
}

// Para pantallas: muestra solo los últimos 4 caracteres
export function enmascarar(valor) {
  const v = String(valor || '');
  return v.length <= 4 ? '••••' : '••••••••' + v.slice(-4);
}