import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { asyncHandler } from '../utils/asyncHandler.js';

// Carpeta pos-bridge/ en la raíz del repositorio (back/src/controllers → raíz)
const CARPETA = fileURLToPath(new URL('../../../pos-bridge/', import.meta.url));

const leer = (nombre) => readFile(CARPETA + nombre);
const enviarTexto = (res, buffer) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.send(buffer);
};

// La versión y la huella del programa: cada PC la compara antes de actualizarse
export const version = asyncHandler(async (req, res) => {
  const buffer = await leer('pos-bridge.ps1');
  const m = /\$VERSION\s*=\s*'([^']+)'/.exec(buffer.toString('utf8'));
  res.json({ version: m?.[1] ?? null, sha256: createHash('sha256').update(buffer).digest('hex') });
});

export const programa = asyncHandler(async (req, res) => enviarTexto(res, await leer('pos-bridge.ps1')));
export const instalador = asyncHandler(async (req, res) => enviarTexto(res, await leer('instalar.ps1')));