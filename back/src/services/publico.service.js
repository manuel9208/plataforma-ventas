import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import * as repo from '../repositories/publico.repository.js';
import * as ser from '../serializers/publico.serializer.js';

export async function listarSucursales(empresa) {
  return (await repo.listarSucursales(pool, empresa.id)).map(ser.sucursal);
}

export async function catalogo(empresa, q) {
  if (!(await repo.existeSucursal(pool, empresa.id, q.sucursalId))) {
    throw new ErrorHttp(404, 'Sucursal no encontrada');
  }
  const base = { pagina: q.pagina, limite: q.limite };

  if (q.tipo === 'servicios') {
    // Los servicios solo existen en el giro de limpieza
    if (empresa.tipo_negocio !== 'limpieza') return { datos: [], total: 0, ...base };
    const { filas, total } = await repo.listarServicios(pool, empresa.id, q.sucursalId, q);
    return { datos: filas.map(ser.servicio), total, ...base };
  }

  const { filas, total } = await repo.listarProductos(pool, empresa.id, q.sucursalId, q);
  return { datos: filas.map(ser.producto), total, ...base };
}