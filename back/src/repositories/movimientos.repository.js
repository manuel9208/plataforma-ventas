import { exigirEmpresa } from '../utils/tenant.js';

const COLUMNAS = `
  m.id, m.turno_id, m.usuario_id, m.tipo, m.categoria, m.concepto, m.monto, m.recibe_nombre, m.referencia,
  m.creado_en, m.anulado_en, m.anulado_motivo, u.nombre AS hizo, a.nombre AS anulo`;

const DESDE = `
  FROM caja_movimientos m
  JOIN usuarios u ON u.id = m.usuario_id AND u.empresa_id = m.empresa_id
  LEFT JOIN usuarios a ON a.id = m.anulado_por AND a.empresa_id = m.empresa_id`;

export async function buscar(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${DESDE} WHERE m.empresa_id = $1 AND m.id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function listarDeTurno(db, empresaId, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ${COLUMNAS} ${DESDE} WHERE m.empresa_id = $1 AND m.turno_id = $2 ORDER BY m.creado_en, m.id LIMIT 200`,
    [empresaId, turnoId]
  );
  return r.rows;
}

// Devuelve false si el id ya existía (reintento)
export async function insertar(db, empresaId, x) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO caja_movimientos
       (id, empresa_id, sucursal_id, turno_id, caja_id, usuario_id, tipo, categoria, concepto, monto, recibe_nombre, referencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [x.id, empresaId, x.sucursalId, x.turnoId, x.cajaId, x.usuarioId, x.tipo, x.categoria, x.concepto, x.monto, x.recibe, x.referencia]
  );
  return r.rowCount > 0;
}

// Solo se anula dentro del turno en curso. Devuelve false si ya estaba anulado.
export async function anular(db, empresaId, id, turnoId, x) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE caja_movimientos
     SET anulado_en = now(), anulado_por = $4, anulado_autorizado_por = $5, anulado_motivo = $6
     WHERE empresa_id = $1 AND id = $2 AND turno_id = $3 AND anulado_en IS NULL`,
    [empresaId, id, turnoId, x.por, x.autorizadoPor, x.motivo]
  );
  return r.rowCount > 0;
}