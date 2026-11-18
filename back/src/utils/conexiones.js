import { pool } from '../config/db.js';
import { descifrar } from './cifrado.js';
import * as repo from '../repositories/conexiones.repository.js';

// Configuración de un servicio (por ejemplo "whatsapp") para una sucursal.
// Si la sucursal tiene la suya, se usa SOLO esa; si no, la de la empresa. Nunca se mezclan.
// Uso: const { origen, valores } = await resolverGrupo(empresaId, sucursalId, 'whatsapp');
export async function resolverGrupo(empresaId, sucursalId, grupo) {
  const variables = (await repo.listarVariables(pool)).filter((v) => v.grupo === grupo);
  const deEmpresa = await repo.valoresEmpresa(pool, empresaId);
  const deSucursal = sucursalId ? await repo.valoresSucursal(pool, empresaId, sucursalId) : new Map();

  const propia = variables.some((v) => deSucursal.has(v.clave));
  const fuente = propia ? deSucursal : deEmpresa;

  const valores = {};
  for (const v of variables) {
    const cifrado = fuente.get(v.clave);
    let valor = cifrado ? descifrar(cifrado) : null;
    // Como último recurso, el .env global (solo cuando no hay configuración propia de la sucursal)
    if (valor === null && !propia) valor = process.env[v.clave.toUpperCase()] ?? null;
    valores[v.clave] = valor ?? v.defecto ?? null;
  }
  return { origen: propia ? 'sucursal' : 'empresa', valores };
}