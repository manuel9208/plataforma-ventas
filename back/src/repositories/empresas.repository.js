import { pool } from '../config/db.js';

const COLUMNAS = `e.id, e.slug, e.nombre, e.tipo_negocio, e.zona_horaria, e.moneda, e.dominios_permitidos, e.activo,
  e.suspendida, e.suspension_motivo, e.suspendida_en, e.creado_en`;

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

export async function buscarPorSlug(slug) {
  const r = await pool.query(
    `SELECT id, slug, nombre, tipo_negocio, zona_horaria, moneda, dominios_permitidos, activo, suspendida, suspension_motivo
     FROM empresas WHERE slug = $1`,
    [slug]
  );
  return r.rows[0] || null;
}

// ---------- Para la pantalla Empresa (solo AdminGlobal; empresas es una tabla global) ----------
export async function listar(db, { buscar, estado, limite, pagina }) {
  const params = [];
  let filtro = 'WHERE TRUE';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro += ` AND (e.nombre ILIKE $${params.length} OR e.slug ILIKE $${params.length})`;
  }
  if (estado === 'activas') filtro += ' AND NOT e.suspendida';
  if (estado === 'suspendidas') filtro += ' AND e.suspendida';

  const total = await db.query(`SELECT count(*) AS n FROM empresas e ${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS},
            (SELECT count(*) FROM sucursales s WHERE s.empresa_id = e.id AND s.activo) AS sucursales,
            (SELECT count(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.activo) AS empleados
     FROM empresas e ${filtro}
     ORDER BY e.nombre, e.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, id) {
  const r = await db.query(
    `SELECT ${COLUMNAS},
            (SELECT count(*) FROM sucursales s WHERE s.empresa_id = e.id AND s.activo) AS sucursales,
            (SELECT count(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.activo) AS empleados
     FROM empresas e WHERE e.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

// Las columnas salen de esta lista, nunca del usuario
const EDITABLES = new Set(['nombre', 'moneda', 'dominios_permitidos']);

export async function actualizar(db, id, campos) {
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => (c === 'dominios_permitidos' ? `${c} = $${i + 2}::text[]` : `${c} = $${i + 2}`)).join(', ');
  await db.query(`UPDATE empresas SET ${sets} WHERE id = $1`, [id, ...claves.map((c) => campos[c])]);
}

// Devuelve false si ya estaba suspendida
export async function suspender(db, id, motivo, adminGlobalId) {
  const r = await db.query(
    `UPDATE empresas SET suspendida = TRUE, suspension_motivo = $2, suspendida_en = now(), suspendida_por_global = $3
     WHERE id = $1 AND NOT suspendida`,
    [id, motivo, adminGlobalId]
  );
  return r.rowCount > 0;
}

// Devuelve false si no estaba suspendida
export async function reactivar(db, id) {
  const r = await db.query(
    `UPDATE empresas SET suspendida = FALSE, suspension_motivo = NULL, suspendida_en = NULL, suspendida_por_global = NULL
     WHERE id = $1 AND suspendida`,
    [id]
  );
  return r.rowCount > 0;
}

export async function tieneVentas(db, empresaId) {
  const r = await db.query(`SELECT EXISTS (SELECT 1 FROM ventas WHERE empresa_id = $1) AS hay`, [empresaId]);
  return r.rows[0].hay;
}