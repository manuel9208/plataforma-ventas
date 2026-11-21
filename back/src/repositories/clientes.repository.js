import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const COLUMNAS =
  'id, nombre, telefono, correo, notas, acepta_whatsapp, consentimiento_whatsapp_en, activo, creado_en, cumple_mes, cumple_dia, (pin_hash IS NOT NULL) AS tiene_pin';
const EDITABLES = new Set([
  'nombre',
  'telefono',
  'correo',
  'notas',
  'acepta_whatsapp',
  'consentimiento_whatsapp_en',
  'activo',
  'cumple_mes',
  'cumple_dia',
]);

// Búsqueda por teléfono (empieza con) y/o por nombre (contiene)
export async function listar(db, empresaId, { telefono, nombre, activo, perfil, limite, pagina }) {
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
  // MISMA regla que estadoPerfil (shared/calculos/perfilCliente.js): correo + cumpleaños + PIN
  if (perfil) {
    filtro += ` AND ${perfil === 'completo' ? '' : 'NOT '}(correo IS NOT NULL AND cumple_mes IS NOT NULL AND cumple_dia IS NOT NULL AND pin_hash IS NOT NULL)`;
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
       (empresa_id, nombre, telefono, correo, notas, acepta_whatsapp, consentimiento_whatsapp_en, creado_por, cumple_mes, cumple_dia)
     VALUES ($1, $2, $3, $4, $5, $6::boolean, CASE WHEN $6::boolean THEN now() END, $7, $8, $9)
     RETURNING id`,
    [
      empresaId,
      d.nombre,
      d.telefono,
      d.correo ?? null,
      d.notas ?? null,
      d.aceptaWhatsapp,
      d.usuarioId ?? null,
      d.cumpleanos?.mes ?? null,
      d.cumpleanos?.dia ?? null,
    ]
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

// El PIN solo se guarda cifrado y nunca sale en ninguna consulta.
// Sin "reemplazar" solo se crea si el cliente no tenía uno (si dos cajeros lo piden a la vez, gana uno).
export async function guardarPin(db, empresaId, id, pinHash, reemplazar) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE clientes SET pin_hash = $3, pin_creado_en = now(), actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2 AND ($4::boolean OR pin_hash IS NULL)`,
    [empresaId, id, pinHash, reemplazar]
  );
  return r.rowCount > 0;
}