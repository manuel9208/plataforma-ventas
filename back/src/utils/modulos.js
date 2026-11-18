import { pool } from '../config/db.js';
import * as repo from '../repositories/modulos.repository.js';

const VIGENCIA_MS = 30_000;
const cache = new Map(); // empresaId -> { hasta, claves }

// Módulos activos de una empresa. Se guarda en memoria 30 segundos para no consultar en cada petición.
export async function modulosActivos(empresaId) {
  const c = cache.get(empresaId);
  if (c && Date.now() < c.hasta) return c.claves;
  const claves = await repo.clavesActivas(pool, empresaId);
  cache.set(empresaId, { hasta: Date.now() + VIGENCIA_MS, claves });
  return claves;
}

export const moduloActivo = async (empresaId, clave) => (await modulosActivos(empresaId)).includes(clave);

// Se llama al cambiar un módulo para que se note de inmediato
export const olvidarModulos = (empresaId) => cache.delete(empresaId);