import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const COLUMNAS = `
  s.id, s.sku, s.nombre, s.descripcion, s.departamento_id,
  d.nombre AS departamento_nombre, d.codigo AS departamento_codigo,
  s.tasa_iva_id, s.tiempo_estimado_horas, s.visible_publico, s.activo,
  s.baja_en, s.baja_motivo, s.creado_en, s.actualizado_en`;

const RESUMEN_PRECIOS = `
  (SELECT COALESCE(json_agg(json_build_object(
            'tipoArticuloId', sp.tipo_articulo_id, 'tipo', ta.nombre, 'precio', sp.precio)
          ORDER BY ta.orden, ta.id), '[]'::json)
     FROM servicio_precios sp
     JOIN tipos_articulo ta ON ta.id = sp.tipo_articulo_id AND ta.empresa_id = sp.empresa_id
     WHERE sp.empresa_id = s.empresa_id AND sp.servicio_id = s.id) AS precios`;

// $1 empresa, $2 sucursales del actor.
// Se ven los servicios de sus sucursales y los que aún no tienen sucursal asignada.
const FROM = `
  FROM servicios s
  JOIN departamentos d ON d.id = s.departamento_id AND d.empresa_id = s.empresa_id
  WHERE s.empresa_id = $1
    AND (
      EXISTS (SELECT 1 FROM servicio_sucursal ss
              WHERE ss.empresa_id = s.empresa_id AND ss.servicio_id = s.id AND ss.activo
                AND ss.sucursal_id = ANY($2::bigint[]))
      OR NOT EXISTS (SELECT 1 FROM servicio_sucursal ss
                     WHERE ss.empresa_id = s.empresa_id AND ss.servicio_id = s.id AND ss.activo)
    )`;

const EDITABLES = new Set([
  'nombre', 'descripcion', 'departamento_id', 'tasa_iva_id', 'tiempo_estimado_horas',
  'visible_publico', 'activo', 'baja_en', 'baja_motivo', 'baja_por', 'actualizado_por',
]);

// ---------- Servicio ----------
export async function listar(db, empresaId, sucursales, { buscar, activo, departamentoId, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';

  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro += ` AND (s.nombre ILIKE $${n} OR s.sku ILIKE $${n})`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND s.activo = $${params.length}`;
  }
  if (departamentoId !== undefined) {
    params.push(departamentoId);
    filtro += ` AND s.departamento_id = $${params.length}`;
  }

  const total = await db.query(`SELECT count(*) AS n ${FROM}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS}, ${RESUMEN_PRECIOS} ${FROM}${filtro}
     ORDER BY s.nombre, s.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, sucursales, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${FROM} AND s.id = $3`, [empresaId, sucursales, id]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, d) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO servicios (
       empresa_id, sku, nombre, descripcion, departamento_id, tasa_iva_id,
       tiempo_estimado_horas, visible_publico, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING id`,
    [
      empresaId, d.sku, d.nombre, d.descripcion, d.departamentoId, d.tasaIvaId,
      d.tiempoHoras, d.visiblePublico, d.usuarioId,
    ]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE servicios SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
    ...claves.map((c) => campos[c]),
  ]);
}

export async function contarTiposActivos(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) AS n FROM tipos_articulo WHERE empresa_id = $1 AND activo AND id = ANY($2::bigint[])`,
    [empresaId, ids]
  );
  return r.rows[0].n;
}

// ---------- Precio general por tipo de artículo ----------
export async function listarPrecios(db, empresaId, servicioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT tipo_articulo_id, precio FROM servicio_precios
     WHERE empresa_id = $1 AND servicio_id = $2 ORDER BY tipo_articulo_id`,
    [empresaId, servicioId]
  );
  return r.rows;
}

export async function reemplazarPrecios(db, empresaId, servicioId, filas) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM servicio_precios WHERE empresa_id = $1 AND servicio_id = $2`, [empresaId, servicioId]);
  await db.query(
    `INSERT INTO servicio_precios (empresa_id, servicio_id, tipo_articulo_id, precio)
     SELECT $1::bigint, $2::bigint, x.t, x.p
     FROM unnest($3::bigint[], $4::numeric[]) AS x(t, p)`,
    [empresaId, servicioId, filas.map((f) => f.tipoArticuloId), filas.map((f) => f.precio)]
  );
  // Un precio propio de sucursal no puede existir si el tipo ya no tiene precio general
  await db.query(
    `DELETE FROM servicio_precio_sucursal
     WHERE empresa_id = $1 AND servicio_id = $2 AND tipo_articulo_id <> ALL($3::bigint[])`,
    [empresaId, servicioId, filas.map((f) => f.tipoArticuloId)]
  );
}

// ---------- Sucursales y precios propios ----------
export async function listarSucursales(db, empresaId, servicioId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT sucursal_id FROM servicio_sucursal
     WHERE empresa_id = $1 AND servicio_id = $2 AND activo AND sucursal_id = ANY($3::bigint[])
     ORDER BY sucursal_id`,
    [empresaId, servicioId, sucursales]
  );
  return r.rows;
}

export async function guardarSucursal(db, empresaId, servicioId, sucursalId) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO servicio_sucursal (empresa_id, servicio_id, sucursal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (servicio_id, sucursal_id) DO UPDATE
       SET activo = TRUE, actualizado_en = now()
       WHERE servicio_sucursal.empresa_id = EXCLUDED.empresa_id`,
    [empresaId, servicioId, sucursalId]
  );
}

export async function quitarSucursales(db, empresaId, servicioId, sucursalIds) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE servicio_sucursal SET activo = FALSE, actualizado_en = now()
     WHERE empresa_id = $1 AND servicio_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, servicioId, sucursalIds]
  );
}

export async function listarPreciosSucursal(db, empresaId, servicioId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT tipo_articulo_id, sucursal_id, precio FROM servicio_precio_sucursal
     WHERE empresa_id = $1 AND servicio_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, servicioId, sucursales]
  );
  return r.rows;
}

// Reemplaza los precios propios de las sucursales indicadas (las demás no se tocan)
export async function reemplazarPreciosSucursal(db, empresaId, servicioId, sucursales, filas) {
  exigirEmpresa(empresaId);
  await db.query(
    `DELETE FROM servicio_precio_sucursal
     WHERE empresa_id = $1 AND servicio_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, servicioId, sucursales]
  );
  if (!filas.length) return;
  await db.query(
    `INSERT INTO servicio_precio_sucursal (empresa_id, servicio_id, tipo_articulo_id, sucursal_id, precio)
     SELECT $1::bigint, $2::bigint, x.t, x.s, x.p
     FROM unnest($3::bigint[], $4::bigint[], $5::numeric[]) AS x(t, s, p)`,
    [
      empresaId,
      servicioId,
      filas.map((f) => f.tipoArticuloId),
      filas.map((f) => f.sucursalId),
      filas.map((f) => f.precio),
    ]
  );
}

// ---------- Extras del servicio ----------
export async function listarExtraIds(db, empresaId, servicioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT extra_id FROM servicio_extras WHERE empresa_id = $1 AND servicio_id = $2 ORDER BY extra_id`,
    [empresaId, servicioId]
  );
  return r.rows;
}

export async function reemplazarExtras(db, empresaId, servicioId, extraIds) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM servicio_extras WHERE empresa_id = $1 AND servicio_id = $2`, [empresaId, servicioId]);
  if (!extraIds.length) return;
  await db.query(
    `INSERT INTO servicio_extras (empresa_id, servicio_id, extra_id)
     SELECT $1::bigint, $2::bigint, unnest($3::bigint[])`,
    [empresaId, servicioId, extraIds]
  );
}