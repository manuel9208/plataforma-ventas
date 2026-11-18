import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const COLUMNAS = `
  p.id, p.sku, p.nombre, p.descripcion, p.marca, p.departamento_id,
  d.nombre AS departamento_nombre, d.codigo AS departamento_codigo,
  p.tasa_iva_id, p.unidad_base, p.costo_ultimo, p.costo_promedio, p.merma_esperada_pct,
  p.controla_inventario, p.lleva_caducidad, p.visible_publico, p.activo,
  p.baja_en, p.baja_motivo, p.creado_en, p.actualizado_en`;

const RESUMEN_PRESENTACIONES = `
  (SELECT COALESCE(json_agg(json_build_object(
            'id', pp.id, 'nombre', pp.nombre, 'unidad', pp.unidad, 'factor', pp.factor,
            'precio', pp.precio, 'seVende', pp.se_vende, 'esBase', pp.es_base)
          ORDER BY pp.es_base DESC, pp.id), '[]'::json)
     FROM producto_presentaciones pp
     WHERE pp.empresa_id = p.empresa_id AND pp.producto_id = p.id AND pp.activo) AS presentaciones`;

// $1 empresa, $2 sucursales del actor.
// Se ven los productos de sus sucursales y los que aún no tienen sucursal asignada.
const FROM = `
  FROM productos p
  JOIN departamentos d ON d.id = p.departamento_id AND d.empresa_id = p.empresa_id
  WHERE p.empresa_id = $1
    AND (
      EXISTS (SELECT 1 FROM producto_sucursal ps
              WHERE ps.empresa_id = p.empresa_id AND ps.producto_id = p.id AND ps.activo
                AND ps.sucursal_id = ANY($2::bigint[]))
      OR NOT EXISTS (SELECT 1 FROM producto_sucursal ps
                     WHERE ps.empresa_id = p.empresa_id AND ps.producto_id = p.id AND ps.activo)
    )`;

const EDITABLES = new Set([
  'nombre', 'descripcion', 'marca', 'departamento_id', 'tasa_iva_id', 'unidad_base',
  'costo_ultimo', 'costo_promedio', 'merma_esperada_pct', 'controla_inventario', 'lleva_caducidad',
  'visible_publico', 'activo', 'baja_en', 'baja_motivo', 'baja_por', 'actualizado_por',
]);

// ---------- Producto ----------
export async function listar(db, empresaId, sucursales, { buscar, activo, departamentoId, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';

  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro += ` AND (p.nombre ILIKE $${n} OR p.sku ILIKE $${n} OR p.marca ILIKE $${n}
      OR EXISTS (SELECT 1 FROM codigos_barras cb
                 JOIN producto_presentaciones pp ON pp.id = cb.presentacion_id AND pp.empresa_id = cb.empresa_id
                 WHERE cb.empresa_id = p.empresa_id AND pp.producto_id = p.id AND cb.codigo ILIKE $${n}))`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND p.activo = $${params.length}`;
  }
  if (departamentoId !== undefined) {
    params.push(departamentoId);
    filtro += ` AND p.departamento_id = $${params.length}`;
  }

  const total = await db.query(`SELECT count(*) AS n ${FROM}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS}, ${RESUMEN_PRESENTACIONES} ${FROM}${filtro}
     ORDER BY p.nombre, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, sucursales, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${FROM} AND p.id = $3`, [empresaId, sucursales, id]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, d) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO productos (
       empresa_id, sku, nombre, descripcion, marca, departamento_id, tasa_iva_id, unidad_base,
       costo_ultimo, costo_promedio, merma_esperada_pct, controla_inventario, lleva_caducidad,
       visible_publico, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $9::numeric, $10, $11, $12, $13, $14, $14)
     RETURNING id`,
    [
      empresaId, d.sku, d.nombre, d.descripcion, d.marca, d.departamentoId, d.tasaIvaId, d.unidadBase,
      d.costo, d.mermaEsperadaPct, d.controlaInventario, d.llevaCaducidad, d.visiblePublico, d.usuarioId,
    ]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE productos SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
    ...claves.map((c) => campos[c]),
  ]);
}

// ---------- Presentaciones ----------
export async function listarPresentaciones(db, empresaId, productoId, { soloActivas = false } = {}) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, nombre, unidad, factor, precio, se_vende, se_compra, es_base, activo
     FROM producto_presentaciones
     WHERE empresa_id = $1 AND producto_id = $2 ${soloActivas ? 'AND activo' : ''}
     ORDER BY es_base DESC, id`,
    [empresaId, productoId]
  );
  return r.rows;
}

export async function insertarPresentacion(db, empresaId, productoId, p) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO producto_presentaciones
       (empresa_id, producto_id, nombre, unidad, factor, precio, se_vende, se_compra, es_base)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [empresaId, productoId, p.nombre, p.unidad, p.factor, p.precio, p.seVende, p.seCompra, p.esBase]
  );
  return r.rows[0].id;
}

export async function actualizarPresentacion(db, empresaId, id, p) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE producto_presentaciones
     SET nombre = $3, unidad = $4, factor = $5, precio = $6, se_vende = $7, se_compra = $8,
         es_base = $9, activo = TRUE, actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id, p.nombre, p.unidad, p.factor, p.precio, p.seVende, p.seCompra, p.esBase]
  );
}

// Se limpia la marca de "base" antes de reasignarla (solo puede haber una)
export async function limpiarBase(db, empresaId, productoId) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE producto_presentaciones SET es_base = FALSE
     WHERE empresa_id = $1 AND producto_id = $2 AND es_base`,
    [empresaId, productoId]
  );
}

export async function desactivarPresentaciones(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE producto_presentaciones SET activo = FALSE, es_base = FALSE, actualizado_en = now()
     WHERE empresa_id = $1 AND id = ANY($2::bigint[])`,
    [empresaId, ids]
  );
}

// ---------- Códigos de barras ----------
export async function listarCodigos(db, empresaId, productoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT cb.id, cb.presentacion_id, cb.codigo, cb.es_interno
     FROM codigos_barras cb
     JOIN producto_presentaciones pp ON pp.id = cb.presentacion_id AND pp.empresa_id = cb.empresa_id
     WHERE cb.empresa_id = $1 AND pp.producto_id = $2
     ORDER BY cb.es_interno DESC, cb.id`,
    [empresaId, productoId]
  );
  return r.rows;
}

export async function insertarCodigo(db, empresaId, presentacionId, codigo, esInterno) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO codigos_barras (empresa_id, presentacion_id, codigo, es_interno) VALUES ($1, $2, $3, $4)`,
    [empresaId, presentacionId, codigo, esInterno]
  );
}

export async function borrarCodigos(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM codigos_barras WHERE empresa_id = $1 AND id = ANY($2::bigint[])`, [empresaId, ids]);
}

// ---------- Sucursales y precios por sucursal ----------
export async function listarProductoSucursales(db, empresaId, productoId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT sucursal_id, stock_minimo FROM producto_sucursal
     WHERE empresa_id = $1 AND producto_id = $2 AND activo AND sucursal_id = ANY($3::bigint[])
     ORDER BY sucursal_id`,
    [empresaId, productoId, sucursales]
  );
  return r.rows;
}

export async function guardarSucursal(db, empresaId, productoId, sucursalId, stockMinimo) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO producto_sucursal (empresa_id, producto_id, sucursal_id, stock_minimo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (producto_id, sucursal_id) DO UPDATE
       SET stock_minimo = EXCLUDED.stock_minimo, activo = TRUE, actualizado_en = now()
       WHERE producto_sucursal.empresa_id = EXCLUDED.empresa_id`,
    [empresaId, productoId, sucursalId, stockMinimo]
  );
}

export async function quitarSucursales(db, empresaId, productoId, sucursalIds) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE producto_sucursal SET activo = FALSE, actualizado_en = now()
     WHERE empresa_id = $1 AND producto_id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, productoId, sucursalIds]
  );
}

export async function listarPreciosSucursal(db, empresaId, productoId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT pps.presentacion_id, pps.sucursal_id, pps.precio
     FROM presentacion_precio_sucursal pps
     JOIN producto_presentaciones pp ON pp.id = pps.presentacion_id AND pp.empresa_id = pps.empresa_id
     WHERE pps.empresa_id = $1 AND pp.producto_id = $2 AND pps.sucursal_id = ANY($3::bigint[])`,
    [empresaId, productoId, sucursales]
  );
  return r.rows;
}

// Reemplaza los precios propios de las sucursales indicadas (las demás no se tocan)
export async function reemplazarPrecios(db, empresaId, productoId, sucursales, filas) {
  exigirEmpresa(empresaId);
  await db.query(
    `DELETE FROM presentacion_precio_sucursal
     WHERE empresa_id = $1 AND sucursal_id = ANY($2::bigint[])
       AND presentacion_id IN (SELECT id FROM producto_presentaciones WHERE empresa_id = $1 AND producto_id = $3)`,
    [empresaId, sucursales, productoId]
  );
  if (!filas.length) return;
  await db.query(
    `INSERT INTO presentacion_precio_sucursal (empresa_id, presentacion_id, sucursal_id, precio)
     SELECT $1::bigint, x.p, x.s, x.pr
     FROM unnest($2::bigint[], $3::bigint[], $4::numeric[]) AS x(p, s, pr)`,
    [empresaId, filas.map((f) => f.presentacionId), filas.map((f) => f.sucursalId), filas.map((f) => f.precio)]
  );
}

export async function registrarPrecio(db, empresaId, e) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO historial_precios
       (empresa_id, sucursal_id, entidad, entidad_id, precio_anterior, precio_nuevo, usuario_id, admin_global_id)
     VALUES ($1, $2, 'presentacion', $3, $4, $5, $6, $7)`,
    [empresaId, e.sucursalId, e.presentacionId, e.anterior, e.nuevo, e.usuarioId ?? null, e.adminGlobalId ?? null]
  );
}


// ---------- Precios de mayoreo ----------
export async function listarPreciosVolumen(db, empresaId, productoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.presentacion_id, v.cantidad_minima, v.precio
     FROM presentacion_precios_volumen v
     JOIN producto_presentaciones pp ON pp.id = v.presentacion_id AND pp.empresa_id = v.empresa_id
     WHERE v.empresa_id = $1 AND pp.producto_id = $2
     ORDER BY v.presentacion_id, v.cantidad_minima`,
    [empresaId, productoId]
  );
  return r.rows;
}

// Reemplaza todas las reglas de mayoreo del producto
export async function reemplazarPreciosVolumen(db, empresaId, productoId, filas) {
  exigirEmpresa(empresaId);
  await db.query(
    `DELETE FROM presentacion_precios_volumen
     WHERE empresa_id = $1
       AND presentacion_id IN (SELECT id FROM producto_presentaciones WHERE empresa_id = $1 AND producto_id = $2)`,
    [empresaId, productoId]
  );
  if (!filas.length) return;
  await db.query(
    `INSERT INTO presentacion_precios_volumen (empresa_id, presentacion_id, cantidad_minima, precio)
     SELECT $1::bigint, x.p, x.c, x.pr
     FROM unnest($2::bigint[], $3::numeric[], $4::numeric[]) AS x(p, c, pr)`,
    [empresaId, filas.map((f) => f.presentacionId), filas.map((f) => f.cantidadMinima), filas.map((f) => f.precio)]
  );
}