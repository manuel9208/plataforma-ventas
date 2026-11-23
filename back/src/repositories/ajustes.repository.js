import { exigirEmpresa } from '../utils/tenant.js';

export async function buscarAjuste(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, venta_id, usuario_id FROM venta_ajustes WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

// La nota, solo si es de una sucursal permitida (sin bloquear nada)
export async function buscarNota(db, empresaId, ventaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, sucursal_id, tiene_servicios FROM ventas WHERE empresa_id = $1 AND id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, ventaId, sucursales]
  );
  return r.rows[0] || null;
}

// Todas las partidas de la nota, bloqueadas mientras dura la transacción
export async function partidasDeVenta(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.id, vp.tipo, vp.nombre, vp.total, vp.ajuste_id, ps.estado_trabajo, pe.padre_partida_id
     FROM venta_partidas vp
     LEFT JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     LEFT JOIN partida_extra pe ON pe.partida_id = vp.id AND pe.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = $2
     ORDER BY vp.orden
     FOR UPDATE OF vp`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// Valor de lo que sigue vigente en la nota (en pesos)
export async function valoresVigentes(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(sum(vp.total - vp.valor_devuelto) FILTER (WHERE vp.tipo = 'producto' AND vp.ajuste_id IS NULL), 0) AS productos,
            COALESCE(sum(vp.total) FILTER (WHERE vp.tipo IN ('servicio', 'extra') AND vp.ajuste_id IS NULL), 0) AS servicios,
            COALESCE(sum(vp.total) FILTER (WHERE vp.tipo IN ('servicio', 'extra') AND vp.ajuste_id IS NULL
                                             AND COALESCE(ps.estado_trabajo, ps2.estado_trabajo) IN ('listo', 'entregado')), 0) AS hechos
     FROM venta_partidas vp
     LEFT JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     LEFT JOIN partida_extra pe ON pe.partida_id = vp.id AND pe.empresa_id = vp.empresa_id
     LEFT JOIN partida_servicio ps2 ON ps2.partida_id = pe.padre_partida_id AND ps2.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = $2`,
    [empresaId, ventaId]
  );
  const f = r.rows[0];
  return { productos: Number(f.productos), servicios: Number(f.servicios), hechos: Number(f.hechos) };
}

// Devuelve false si el id ya existía (reintento)
export async function insertarAjuste(db, empresaId, a) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_ajustes
       (id, empresa_id, venta_id, sucursal_id, turno_id, caja_id, usuario_id, tipo, autorizado_por, motivo,
        valor_cancelado, tope, devuelto, retenido)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [a.id, empresaId, a.ventaId, a.sucursalId, a.turnoId, a.cajaId, a.usuarioId, a.tipo, a.autorizadoPor, a.motivo,
     a.valorCancelado, a.tope, a.devuelto, a.retenido]
  );
  return r.rowCount > 0;
}

// Marca las partidas como canceladas o devueltas. Devuelve cuántas cambió.
export async function marcarPartidas(db, empresaId, ids, ajusteId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE venta_partidas SET ajuste_id = $3 WHERE empresa_id = $1 AND id = ANY($2::uuid[]) AND ajuste_id IS NULL`,
    [empresaId, ids, ajusteId]
  );
  return r.rowCount;
}

// Solo se cancelan servicios que siguen en espera. Devuelve cuántos cambió.
export async function cancelarServicios(db, empresaId, partidaIds) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE partida_servicio SET estado_trabajo = 'cancelado'
     WHERE empresa_id = $1 AND partida_id = ANY($2::uuid[]) AND estado_trabajo IN ('recibido', 'en_proceso')`,
    [empresaId, partidaIds]
  );
  return r.rowCount;
}

export async function insertarReembolso(db, empresaId, x) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO venta_reembolsos (empresa_id, ajuste_id, venta_id, turno_id, caja_id, usuario_id, forma, monto, referencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [empresaId, x.ajusteId, x.ventaId, x.turnoId, x.cajaId, x.usuarioId, x.forma, x.monto, x.referencia ?? null]
  );
}

export async function sumarAjustes(db, empresaId, ventaId, s) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE ventas SET cancelado = cancelado + $3, ajustado = ajustado + $4, retenido = retenido + $5, reembolsado = reembolsado + $6
     WHERE empresa_id = $1 AND id = $2`,
    [empresaId, ventaId, s.cancelado, s.ajustado, s.retenido, s.reembolsado]
  );
}

export async function listarReembolsos(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT r.forma, r.monto, r.referencia, r.creado_en, a.tipo, a.motivo, u.nombre AS quien, cj.nombre AS caja
     FROM venta_reembolsos r
     JOIN venta_ajustes a ON a.id = r.ajuste_id AND a.empresa_id = r.empresa_id
     JOIN usuarios u ON u.id = r.usuario_id AND u.empresa_id = r.empresa_id
     JOIN cajas cj ON cj.id = r.caja_id AND cj.empresa_id = r.empresa_id
     WHERE r.empresa_id = $1 AND r.venta_id = $2
     ORDER BY r.creado_en, r.id`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// Todo lo que lleva el comprobante
export async function cargarAjuste(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const a = await db.query(
    `SELECT a.id, a.tipo, a.motivo, a.valor_cancelado, a.tope, a.devuelto, a.retenido, a.creado_en,
            u.nombre AS hizo, ru.nivel_jerarquico AS hizo_nivel, au.nombre AS autorizo, rau.nivel_jerarquico AS autorizo_nivel, cj.nombre AS caja
     FROM venta_ajustes a
     JOIN usuarios u ON u.id = a.usuario_id AND u.empresa_id = a.empresa_id
     JOIN roles ru ON ru.id = u.rol_id AND ru.empresa_id = u.empresa_id
     JOIN cajas cj ON cj.id = a.caja_id AND cj.empresa_id = a.empresa_id
     LEFT JOIN usuarios au ON au.id = a.autorizado_por AND au.empresa_id = a.empresa_id
     LEFT JOIN roles rau ON rau.id = au.rol_id AND rau.empresa_id = au.empresa_id
     WHERE a.empresa_id = $1 AND a.id = $2`,
    [empresaId, id]
  );
  const p = await db.query(
    `SELECT nombre, tipo, total FROM venta_partidas WHERE empresa_id = $1 AND ajuste_id = $2 ORDER BY orden`,
    [empresaId, id]
  );
  const r = await db.query(`SELECT forma, monto, referencia FROM venta_reembolsos WHERE empresa_id = $1 AND ajuste_id = $2 LIMIT 1`, [
    empresaId,
    id,
  ]);
  return { ajuste: a.rows[0] || null, partidas: p.rows, reembolso: r.rows[0] || null };
}