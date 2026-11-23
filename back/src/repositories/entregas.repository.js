import { exigirEmpresa } from '../utils/tenant.js';

export async function buscarEntrega(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, venta_id, usuario_id FROM venta_entregas WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

// Lo necesario para decidir cómo se entrega la nota (sin bloquear nada)
export async function datosParaEntrega(db, empresaId, ventaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.sucursal_id, v.total, v.tiene_servicios, v.pin_entrega_hash,
            v.cancelado, v.ajustado, v.retenido, v.reembolsado,
            (SELECT COALESCE(sum(p.monto), 0) FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id) AS pagado
     FROM ventas v
     WHERE v.empresa_id = $1 AND v.id = $2 AND v.sucursal_id = ANY($3::bigint[])`,
    [empresaId, ventaId, sucursales]
  );
  return r.rows[0] || null;
}

// Quien puede autorizar una entrega: activo, con PIN y con su sucursal. El permiso se revisa en el servicio.
const AUTORIZADOR = `
  SELECT u.id, u.nombre, u.pin_hash, u.permisos,
         EXISTS (SELECT 1 FROM usuario_sucursales x
                 WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id AND x.sucursal_id = $3) AS en_sucursal
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id AND r.activo
  WHERE u.empresa_id = $1 AND u.activo`;

export async function autorizadorPorId(db, empresaId, usuarioId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`${AUTORIZADOR} AND u.id = $2`, [empresaId, usuarioId, sucursalId]);
  return r.rows[0] || null;
}

export async function autorizadorPorTelefono(db, empresaId, telefono, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`${AUTORIZADOR} AND u.telefono = $2`, [empresaId, telefono, sucursalId]);
  return r.rows[0] || null;
}

// Devuelve false si el id ya existía (reintento)
export async function insertarEntrega(db, empresaId, x) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_entregas
       (id, empresa_id, venta_id, sucursal_id, turno_id, caja_id, usuario_id, metodo, autorizado_por, recoge_nombre, motivo, articulos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [x.id, empresaId, x.ventaId, x.sucursalId, x.turnoId, x.cajaId, x.usuarioId, x.metodo, x.autorizadoPor, x.recoge, x.motivo, x.articulos]
  );
  return r.rowCount > 0;
}

// Pasa los artículos (y sus extras) a entregado. Devuelve cuántos artículos cambió.
export async function marcarEntregados(db, empresaId, partidaIds, entregaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE partida_servicio SET estado_trabajo = 'entregado', entrega_id = $3
     WHERE empresa_id = $1 AND partida_id = ANY($2::uuid[]) AND estado_trabajo = 'listo'`,
    [empresaId, partidaIds, entregaId]
  );
  await db.query(
    `UPDATE venta_partidas SET entregado_en = now(), entregado_por = $3
     WHERE empresa_id = $1 AND entregado_en IS NULL
       AND (id = ANY($2::uuid[])
            OR id IN (SELECT partida_id FROM partida_extra WHERE empresa_id = $1 AND padre_partida_id = ANY($2::uuid[])))`,
    [empresaId, partidaIds, usuarioId]
  );
  return r.rowCount;
}

// Todo lo que lleva el ticket de entrega
export async function cargarEntrega(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const e = await db.query(
    `SELECT en.id, en.metodo, en.recoge_nombre, en.motivo, en.articulos, en.creado_en,
            u.nombre AS entrego, ru.nivel_jerarquico AS entrego_nivel, a.nombre AS autorizo, ra.nivel_jerarquico AS autorizo_nivel, cj.nombre AS caja
     FROM venta_entregas en
     JOIN usuarios u ON u.id = en.usuario_id AND u.empresa_id = en.empresa_id
     JOIN roles ru ON ru.id = u.rol_id AND ru.empresa_id = u.empresa_id
     JOIN cajas cj ON cj.id = en.caja_id AND cj.empresa_id = en.empresa_id
     LEFT JOIN usuarios a ON a.id = en.autorizado_por AND a.empresa_id = en.empresa_id
     LEFT JOIN roles ra ON ra.id = a.rol_id AND ra.empresa_id = a.empresa_id
     WHERE en.empresa_id = $1 AND en.id = $2`,
    [empresaId, id]
  );
  const articulos = await db.query(
    `SELECT vp.id, vp.nombre, ps.tipo_articulo_nombre,
            pa.marca, pa.talla, pa.color, pa.modelo, pa.textura, pa.descripcion
     FROM partida_servicio ps
     JOIN venta_partidas vp ON vp.id = ps.partida_id AND vp.empresa_id = ps.empresa_id
     LEFT JOIN partida_articulos pa ON pa.partida_id = vp.id AND pa.empresa_id = vp.empresa_id
     WHERE ps.empresa_id = $1 AND ps.entrega_id = $2
     ORDER BY vp.orden`,
    [empresaId, id]
  );
  const ids = articulos.rows.map((a) => a.id);
  const extras = ids.length
    ? await db.query(
        `SELECT pe.padre_partida_id, vp.nombre
         FROM partida_extra pe
         JOIN venta_partidas vp ON vp.id = pe.partida_id AND vp.empresa_id = pe.empresa_id
         WHERE pe.empresa_id = $1 AND pe.padre_partida_id = ANY($2::uuid[]) ORDER BY vp.orden`,
        [empresaId, ids]
      )
    : { rows: [] };
  return { entrega: e.rows[0] || null, articulos: articulos.rows, extras: extras.rows };
}