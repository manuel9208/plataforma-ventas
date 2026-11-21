import { exigirEmpresa } from '../utils/tenant.js';

const COLUMNAS = `id, nombre, telefono, correo, cumple_mes, cumple_dia, activo, aviso_privacidad_en, pin_creado_en,
                  (pin_hash IS NOT NULL) AS tiene_pin`;
const EDITABLES = new Set(['correo', 'cumple_mes', 'cumple_dia']);

export async function buscarParaLogin(db, empresaId, telefono) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, pin_hash, pin_creado_en, activo FROM clientes WHERE empresa_id = $1 AND telefono = $2`,
    [empresaId, telefono]
  );
  return r.rows[0] || null;
}

export async function obtener(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} FROM clientes WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function pinHashDe(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT pin_hash FROM clientes WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0]?.pin_hash ?? null;
}

export async function actualizarDatos(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE clientes SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
    ...claves.map((c) => campos[c]),
  ]);
}

// Guarda la primera fecha en que aceptó; aceptar otra vez no la cambia
export async function marcarAviso(db, empresaId, id) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE clientes SET aviso_privacidad_en = COALESCE(aviso_privacidad_en, now()) WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id]
  );
}

// Notas de servicio del cliente, la más reciente primero
export async function listarNotas(db, empresaId, clienteId, limite) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.folio, v.total, v.cancelado, v.ajustado, v.retenido, v.reembolsado, v.creado_en,
            s.nombre AS sucursal, COALESCE(s.zona_horaria, e.zona_horaria) AS zona,
            (SELECT COALESCE(sum(p.monto), 0) FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id) AS pagado
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     WHERE v.empresa_id = $1 AND v.cliente_id = $2 AND v.tiene_servicios
     ORDER BY v.creado_en DESC, v.id
     LIMIT $3`,
    [empresaId, clienteId, limite]
  );
  return r.rows;
}

// Los servicios de esas notas con su estado (no se lee el comentario interno ni nada del personal)
export async function serviciosDeNotas(db, empresaId, ventaIds) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.venta_id, vp.id AS partida_id, vp.nombre, vp.total,
            ps.estado_trabajo, ps.fecha_prometida, ps.listo_en,
            pa.marca, pa.talla, pa.color, pa.modelo, pa.textura
     FROM venta_partidas vp
     JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     LEFT JOIN partida_articulos pa ON pa.partida_id = vp.id AND pa.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = ANY($2::uuid[]) AND vp.tipo = 'servicio'
     ORDER BY vp.venta_id, vp.orden`,
    [empresaId, ventaIds]
  );
  return r.rows;
}

// Todas las compras (notas y ventas de mostrador), la más reciente primero
export async function listarCompras(db, empresaId, clienteId, limite) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.folio, v.total, v.cancelado, v.ajustado, v.retenido, v.tiene_servicios, v.creado_en,
            s.nombre AS sucursal, COALESCE(s.zona_horaria, e.zona_horaria) AS zona
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     WHERE v.empresa_id = $1 AND v.cliente_id = $2
     ORDER BY v.creado_en DESC, v.id
     LIMIT $3`,
    [empresaId, clienteId, limite]
  );
  return r.rows;
}