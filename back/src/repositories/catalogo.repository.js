import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

// Nombres de tabla y columna fijos: nunca vienen del usuario
const ENTIDADES = {
  departamentos: {
    tabla: 'departamentos',
    columnas: 'id, codigo, nombre, activo',
    orden: 'codigo',
    buscables: ['nombre', 'codigo'],
    editables: new Set(['nombre', 'activo']),
    fechaModificacion: true,
  },
  tiposArticulo: {
    tabla: 'tipos_articulo',
    columnas: 'id, nombre, orden, activo',
    orden: 'orden, nombre',
    buscables: ['nombre'],
    editables: new Set(['nombre', 'orden', 'activo']),
  },
  tasasIva: {
    tabla: 'tasas_iva',
    columnas: 'id, nombre, porcentaje, es_defecto, activo',
    orden: 'es_defecto DESC, nombre',
    buscables: ['nombre'],
    editables: new Set(['nombre', 'porcentaje', 'es_defecto', 'activo']),
  },
};

const definicion = (entidad) => {
  const d = ENTIDADES[entidad];
  if (!d) throw new Error('Catálogo desconocido: ' + entidad);
  return d;
};

// ---------- Comunes a los tres catálogos ----------
export async function listar(db, empresaId, entidad, { buscar, activo, limite, pagina }) {
  exigirEmpresa(empresaId);
  const d = definicion(entidad);
  const params = [empresaId];
  let filtro = '';

  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro += ` AND (${d.buscables.map((c) => `${c} ILIKE $${n}`).join(' OR ')})`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND activo = $${params.length}`;
  }

  const total = await db.query(`SELECT count(*) AS n FROM ${d.tabla} WHERE empresa_id = $1${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${d.columnas} FROM ${d.tabla} WHERE empresa_id = $1${filtro}
     ORDER BY ${d.orden}, id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, entidad, id) {
  exigirEmpresa(empresaId);
  const d = definicion(entidad);
  const r = await db.query(`SELECT ${d.columnas} FROM ${d.tabla} WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
  ]);
  return r.rows[0] || null;
}

export async function actualizar(db, empresaId, entidad, id, campos) {
  exigirEmpresa(empresaId);
  const d = definicion(entidad);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => d.editables.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(
    `UPDATE ${d.tabla} SET ${sets}${d.fechaModificacion ? ', actualizado_en = now()' : ''}
     WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id, ...claves.map((c) => campos[c])]
  );
}

// ---------- Departamentos ----------
// Bloquea la fila de la empresa para que dos altas a la vez no tomen el mismo código
export async function bloquearEmpresa(db, empresaId) {
  exigirEmpresa(empresaId);
  await db.query(`SELECT id FROM empresas WHERE id = $1 FOR UPDATE`, [empresaId]);
}

export async function siguienteCodigoDepartamento(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(MAX(codigo::int), 0) + 1 AS n FROM departamentos WHERE empresa_id = $1`,
    [empresaId]
  );
  return r.rows[0].n;
}

export async function insertarDepartamento(db, empresaId, { codigo, nombre }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO departamentos (empresa_id, codigo, nombre) VALUES ($1, $2, $3) RETURNING id`,
    [empresaId, codigo, nombre]
  );
  return r.rows[0].id;
}

export async function contarUsoDepartamento(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT (SELECT count(*) FROM productos WHERE empresa_id = $1 AND departamento_id = $2 AND activo)
          + (SELECT count(*) FROM servicios WHERE empresa_id = $1 AND departamento_id = $2 AND activo) AS n`,
    [empresaId, id]
  );
  return r.rows[0].n;
}

// ---------- Tipos de artículo ----------
export async function insertarTipoArticulo(db, empresaId, { nombre }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO tipos_articulo (empresa_id, nombre, orden)
     VALUES ($1, $2, (SELECT COALESCE(MAX(orden), 0) + 1 FROM tipos_articulo WHERE empresa_id = $1))
     RETURNING id`,
    [empresaId, nombre]
  );
  return r.rows[0].id;
}

// ---------- Tasas de IVA ----------
export async function insertarTasaIva(db, empresaId, { nombre, porcentaje }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO tasas_iva (empresa_id, nombre, porcentaje) VALUES ($1, $2, $3) RETURNING id`,
    [empresaId, nombre, porcentaje]
  );
  return r.rows[0].id;
}

export async function quitarTasaPredeterminada(db, empresaId) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE tasas_iva SET es_defecto = FALSE WHERE empresa_id = $1 AND es_defecto`, [empresaId]);
}

export async function contarUsoTasa(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT (SELECT count(*) FROM productos WHERE empresa_id = $1 AND tasa_iva_id = $2 AND activo)
          + (SELECT count(*) FROM servicios WHERE empresa_id = $1 AND tasa_iva_id = $2 AND activo)
          + (SELECT count(*) FROM extras WHERE empresa_id = $1 AND tasa_iva_id = $2 AND activo) AS n`,
    [empresaId, id]
  );
  return r.rows[0].n;
}

// ---------- Configuración de la empresa ----------
const CONFIG_EDITABLE = new Set(['precios_incluyen_iva', 'permitir_venta_sin_existencia']);

export async function obtenerConfig(db, empresaId) {
  exigirEmpresa(empresaId);
  await db.query(`INSERT INTO empresa_config (empresa_id) VALUES ($1) ON CONFLICT DO NOTHING`, [empresaId]);
  const r = await db.query(
    `SELECT precios_incluyen_iva, permitir_venta_sin_existencia FROM empresa_config WHERE empresa_id = $1`,
    [empresaId]
  );
  return r.rows[0];
}

export async function actualizarConfig(db, empresaId, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => CONFIG_EDITABLE.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 2}`).join(', ');
  await db.query(`UPDATE empresa_config SET ${sets}, actualizado_en = now() WHERE empresa_id = $1`, [
    empresaId,
    ...claves.map((c) => campos[c]),
  ]);
}