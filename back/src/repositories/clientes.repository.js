import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const COLUMNAS = 'id, nombre, telefono, correo, notas, acepta_whatsapp, consentimiento_whatsapp_en, activo, creado_en';
const EDITABLES = new Set([
  'nombre',
  'telefono',
  'correo',
  'notas',
  'acepta_whatsapp',
  'consentimiento_whatsapp_en',
  'activo',
]);

// Búsqueda por teléfono (empieza con) y/o por nombre (contiene)
export async function listar(db, empresaId, { telefono, nombre, activo, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId];
  let filtro = '';
  if (telefono) {
    params.push(`${telefono}%`);
    filtro += ` AND telefono LIKE $${params.length}`;
  }
  if (nombre) {
    params.push(escaparLike(nombre));
    filtro += ` AND nombre ILIKE $${params.length}`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND activo = $${params.length}`;
  }
  const total = await db.query(`SELECT count(*) AS n FROM clientes WHERE empresa_id = $1${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS} FROM clientes WHERE empresa_id = $1${filtro}
     ORDER BY nombre, id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} FROM clientes WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, d) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO clientes
       (empresa_id, nombre, telefono, correo, notas, acepta_whatsapp, consentimiento_whatsapp_en, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6::boolean, CASE WHEN $6::boolean THEN now() END, $7)
     RETURNING id`,
    [empresaId, d.nombre, d.telefono, d.correo ?? null, d.notas ?? null, d.aceptaWhatsapp, d.usuarioId ?? null]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
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