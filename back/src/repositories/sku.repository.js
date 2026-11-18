import { armarSku } from '@plataforma/calculos';
import { exigirEmpresa } from '../utils/tenant.js';

// Toma el siguiente consecutivo del departamento en una sola sentencia (atómica).
// Productos y servicios usan este mismo contador, así que sus SKU nunca chocan.
// Devuelve null si el departamento no existe, está inactivo o ya llegó a 9999.
export async function reservarSku(db, empresaId, departamentoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE departamentos
     SET siguiente_consecutivo = siguiente_consecutivo + 1, actualizado_en = now()
     WHERE id = $2 AND empresa_id = $1 AND activo AND siguiente_consecutivo <= 9999
     RETURNING codigo, siguiente_consecutivo - 1 AS consecutivo`,
    [empresaId, departamentoId]
  );
  const f = r.rows[0];
  return f ? armarSku(f.codigo, f.consecutivo) : null;
}