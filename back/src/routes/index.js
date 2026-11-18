import { Router } from 'express';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { resolverTenant } from '../middlewares/resolverTenant.js';
import { autenticar } from '../middlewares/autenticar.js';

export async function crearRouterPrincipal() {
  const principal = Router();
  const carpeta = path.dirname(fileURLToPath(import.meta.url));
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.routes.js')).sort();

  for (const archivo of archivos) {
    const modulo = await import(pathToFileURL(path.join(carpeta, archivo)).href);
    const { ruta, router, publico = false, sinTenant = false } = modulo.default || {};
    if (!ruta || !router) throw new Error(`${archivo} debe exportar por defecto { ruta, router, publico }`);

    if (sinTenant) principal.use(ruta, router);                              // ej. /salud
    else if (publico) principal.use(ruta, resolverTenant, router);           // lista blanca
    else principal.use(ruta, resolverTenant, autenticar, router);            // protegida por defecto
  }
  return principal;
}