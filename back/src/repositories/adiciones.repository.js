import { exigirEmpresa } from '../utils/tenant.js';

export async function buscarAdicion(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, venta_id, usuario_id, total FROM venta_adiciones WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

// La nota, solo si es de una sucursal permitida, bloqueada mientras dura la transacción
export async function bloquearNota(db, empresaId, ventaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, folio, sucursal_id, cliente_id, total, subtotal, iva, precios_incluyen_iva, tiene_servicios, financiada
     FROM ventas WHERE empresa_id = $1 AND id = $2 AND sucursal_id = ANY($3::bigint[]) FOR UPDATE`,
    [empresaId, ventaId, sucursales]
  );
  return r.rows[0] || null;
}

// Último número de orden usado, para que lo nuevo continúe después de lo que ya tiene la nota
export async function ultimosOrdenes(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT (SELECT COALESCE(max(orden), 0) FROM venta_partidas WHERE empresa_id = $1 AND venta_id = $2) AS partidas,
            (SELECT COALESCE(max(orden), 0) FROM venta_articulos WHERE empresa_id = $1 AND venta_id = $2) AS articulos`,
    [empresaId, ventaId]
  );
  return { partidas: Number(r.rows[0].partidas), articulos: Number(r.rows[0].articulos) };
}

// Devuelve false si el id ya existía (reintento)
export async function insertarAdicion(db, empresaId, a) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_adiciones (id, empresa_id, venta_id, sucursal_id, turno_id, usuario_id, subtotal, iva, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [a.id, empresaId, a.ventaId, a.sucursalId, a.turnoId, a.usuarioId, a.subtotal, a.iva, a.total]
  );
  return r.rowCount > 0;
}

// Marca como de la adición todo lo insertado después del orden indicado. Devuelve cuántas partidas marcó.
export async function marcarPartidas(db, empresaId, ventaId, adicionId, ordenDesde) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE venta_partidas SET adicion_id = $3 WHERE empresa_id = $1 AND venta_id = $2 AND orden > $4 AND adicion_id IS NULL`,
    [empresaId, ventaId, adicionId, ordenDesde]
  );
  return r.rowCount;
}

export async function actualizarTotales(db, empresaId, ventaId, t) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE ventas SET subtotal = $3, iva = $4, total = $5 WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    ventaId,
    t.subtotal,
    t.iva,
    t.total,
  ]);
}