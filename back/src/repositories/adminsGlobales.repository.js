// Tabla global: no pertenece a ninguna empresa, por eso estas consultas no llevan empresaId.
const EDITABLES = new Set(['nombre', 'telefono', 'password_hash']);

export async function crear(db, { nombre, telefono, passwordHash }) {
  const r = await db.query(
    `INSERT INTO admins_globales (nombre, telefono, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [nombre, telefono, passwordHash]
  );
  return r.rows[0].id;
}

export async function buscarParaLogin(db, telefono) {
  const r = await db.query(`SELECT id, password_hash, activo FROM admins_globales WHERE telefono = $1`, [telefono]);
  return r.rows[0] || null;
}

export async function obtener(db, id) {
  const r = await db.query(`SELECT id, nombre, telefono, activo FROM admins_globales WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function obtenerHash(db, id) {
  const r = await db.query(`SELECT password_hash FROM admins_globales WHERE id = $1`, [id]);
  return r.rows[0]?.password_hash || null;
}

export async function actualizar(db, id, campos) {
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 2}`).join(', ');
  await db.query(`UPDATE admins_globales SET ${sets} WHERE id = $1`, [id, ...claves.map((c) => campos[c])]);
}