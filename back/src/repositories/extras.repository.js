import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const COLUMNAS = 'id, nombre, precio, tasa_iva_id, activo';
const EDITABLES = new Set(['nombre', 'precio', 'tasa_iva_id', 'activo']);

export async function listar(db, empresaId, { buscar, activo, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro += ` AND nombre ILIKE $${params.length}`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND activo = $${params.length}`;
  }
  const total = await db.query(`SELECT count(*) AS n FROM extras WHERE empresa_id = $1${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS} FROM extras WHERE empresa_id = $1${filtro}
     ORDER BY nombre, id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} FROM extras WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, { nombre, precio, tasaIvaId }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO extras (empresa_id, nombre, precio, tasa_iva_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [empresaId, nombre, precio, tasaIvaId]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE extras SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
    ...claves.map((c) => campos[c]),
  ]);
}

export async function listarActivosSimples(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, nombre, precio FROM extras WHERE empresa_id = $1 AND activo ORDER BY nombre LIMIT 200`,
    [empresaId]
  );
  return r.rows;
}

export async function contarActivos(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) AS n FROM extras WHERE empresa_id = $1 AND activo AND id = ANY($2::bigint[])`,
    [empresaId, ids]
  );
  return r.rows[0].n;
}

export async function listarPreciosSucursal(db, empresaId, extraId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT sucursal_id, precio FROM extra_precio_sucursal
     WHERE empresa_id = $1 AND extra_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, extraId, sucursales]
  );
  return r.rows;
}

// Reemplaza los precios propios de las sucursales indicadas (las demás no se tocan)
export async function reemplazarPreciosSucursal(db, empresaId, extraId, sucursales, filas) {
  exigirEmpresa(empresaId);
  await db.query(
    `DELETE FROM extra_precio_sucursal
     WHERE empresa_id = $1 AND extra_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, extraId, sucursales]
  );
  if (!filas.length) return;
  await db.query(
    `INSERT INTO extra_precio_sucursal (empresa_id, extra_id, sucursal_id, precio)
     SELECT $1::bigint, $2::bigint, x.s, x.p
     FROM unnest($3::bigint[], $4::numeric[]) AS x(s, p)`,
    [empresaId, extraId, filas.map((f) => f.sucursalId), filas.map((f) => f.precio)]
  );
}