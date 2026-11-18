import { pool } from '../config/db.js';
import { listarSucursalIdsActivas } from '../repositories/usuarios.repository.js';

// En una empresa, el admin global se comporta como nivel 0: ve todo y todas las sucursales
export async function construirActorGlobal(empresaId, admin) {
  return {
    id: null,
    adminGlobalId: admin.id,
    esGlobal: true,
    empresaId,
    telefono: admin.telefono,
    nombre: admin.nombre,
    rol: 'adminglobal',
    nivel: 0,
    permisos: { '*': true },
    sucursales: await listarSucursalIdsActivas(pool, empresaId),
  };
}