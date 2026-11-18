// El catálogo y las empresas son tablas globales (sin empresa_id propio): por eso estas consultas se piden con el id de la empresa destino.

export async function listarCatalogo(db) {
  const r = await db.query(
    `SELECT clave, nombre, descripcion, cobro, precio_sugerido, es_base, orden
     FROM catalogo_modulos WHERE activo ORDER BY orden, clave`
  );
  return r.rows;
}

export async function buscarModulo(db, clave) {
  const r = await db.query(`SELECT clave, nombre, cobro, es_base FROM catalogo_modulos WHERE clave = $1 AND activo`, [clave]);
  return r.rows[0] || null;
}

// Lo que tiene esa empresa por módulo (si no hay fila, el módulo está apagado)
export async function listarDeEmpresa(db, empresaId) {
  const r = await db.query(
    `SELECT modulo_clave, activo, precio_propio, vence_en, nota, actualizado_en
     FROM empresa_modulos WHERE empresa_id = $1`,
    [empresaId]
  );
  return r.rows;
}

export async function obtenerDeEmpresa(db, empresaId, clave) {
  const r = await db.query(
    `SELECT modulo_clave, activo, precio_propio, vence_en, nota FROM empresa_modulos WHERE empresa_id = $1 AND modulo_clave = $2`,
    [empresaId, clave]
  );
  return r.rows[0] || null;
}

export async function guardarDeEmpresa(db, empresaId, clave, d, adminGlobalId) {
  await db.query(
    `INSERT INTO empresa_modulos (empresa_id, modulo_clave, activo, precio_propio, vence_en, nota, actualizado_por_global)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7)
     ON CONFLICT (empresa_id, modulo_clave) DO UPDATE SET
       activo = EXCLUDED.activo, precio_propio = EXCLUDED.precio_propio, vence_en = EXCLUDED.vence_en,
       nota = EXCLUDED.nota, actualizado_por_global = EXCLUDED.actualizado_por_global, actualizado_en = now()`,
    [empresaId, clave, d.activo, d.precioPropio, d.venceEn, d.nota, adminGlobalId]
  );
}

export async function sucursalesActivas(db, empresaId) {
  const r = await db.query(`SELECT count(*) AS n FROM sucursales WHERE empresa_id = $1 AND activo`, [empresaId]);
  return r.rows[0].n;
}

// Claves de los módulos que la empresa tiene encendidos y vigentes hoy. "hoy" lo calcula la base en la zona de la empresa.
export async function clavesActivas(db, empresaId) {
  const r = await db.query(
    `SELECT m.clave
     FROM catalogo_modulos m
     JOIN empresas e ON e.id = $1
     LEFT JOIN empresa_modulos x ON x.modulo_clave = m.clave AND x.empresa_id = e.id
     WHERE m.activo
       AND (m.es_base
            OR (x.activo AND (x.vence_en IS NULL OR x.vence_en >= (now() AT TIME ZONE e.zona_horaria)::date)))
     ORDER BY m.orden, m.clave`,
    [empresaId]
  );
  return r.rows.map((f) => f.clave);
}

export async function hoyDeEmpresa(db, empresaId) {
  const r = await db.query(`SELECT (now() AT TIME ZONE zona_horaria)::date AS hoy FROM empresas WHERE id = $1`, [empresaId]);
  return r.rows[0]?.hoy ?? null;
}