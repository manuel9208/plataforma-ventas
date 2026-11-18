import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

// Productos activos de la sucursal, con las presentaciones que se venden y su precio efectivo
const FROM = `
  FROM productos p
  JOIN departamentos d ON d.id = p.departamento_id AND d.empresa_id = p.empresa_id
  WHERE p.empresa_id = $1 AND p.activo AND d.activo
    AND EXISTS (SELECT 1 FROM producto_sucursal x
                WHERE x.empresa_id = p.empresa_id AND x.producto_id = p.id
                  AND x.sucursal_id = $2 AND x.activo)`;

const PRESENTACIONES = `
  (SELECT COALESCE(json_agg(json_build_object(
            'id', pp.id, 'nombre', pp.nombre, 'unidad', pp.unidad, 'factor', pp.factor,
            'precio', COALESCE(ps.precio, pp.precio),
            'mayoreo', (SELECT COALESCE(json_agg(json_build_object('cantidadMinima', v.cantidad_minima, 'precio', v.precio)
                                              ORDER BY v.cantidad_minima), '[]'::json)
                          FROM presentacion_precios_volumen v
                          WHERE v.empresa_id = pp.empresa_id AND v.presentacion_id = pp.id))
          ORDER BY pp.es_base DESC, pp.id), '[]'::json)
     FROM producto_presentaciones pp
     LEFT JOIN presentacion_precio_sucursal ps
       ON ps.presentacion_id = pp.id AND ps.empresa_id = pp.empresa_id AND ps.sucursal_id = $2
     WHERE pp.empresa_id = p.empresa_id AND pp.producto_id = p.id AND pp.activo AND pp.se_vende
       AND COALESCE(ps.precio, pp.precio) IS NOT NULL) AS presentaciones`;

export async function listarProductos(db, empresaId, sucursalId, { buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursalId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro = ` AND (p.nombre ILIKE $${n} OR p.sku ILIKE $${n} OR p.marca ILIKE $${n})`;
  }
  const total = await db.query(`SELECT count(*) AS n ${FROM}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT p.id, p.sku, p.nombre, p.marca, p.unidad_base, p.tasa_iva_id, p.departamento_id, d.nombre AS departamento,
            (SELECT t.porcentaje FROM tasas_iva t WHERE t.id = p.tasa_iva_id AND t.empresa_id = p.empresa_id) AS tasa,
            ${PRESENTACIONES}
     ${FROM}${filtro}
     ORDER BY p.nombre, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  // Un producto sin presentaciones vendibles no sirve en Caja
  return { filas: filas.rows.filter((f) => f.presentaciones.length), total: total.rows[0].n };
}

// Código de barras o SKU exacto
export async function buscarPorCodigo(db, empresaId, sucursalId, codigo) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT p.id, p.sku, p.nombre, p.marca, p.unidad_base, p.tasa_iva_id, p.departamento_id, d.nombre AS departamento,
            (SELECT t.porcentaje FROM tasas_iva t WHERE t.id = p.tasa_iva_id AND t.empresa_id = p.empresa_id) AS tasa,
            ${PRESENTACIONES},
            (SELECT cb.presentacion_id FROM codigos_barras cb
              JOIN producto_presentaciones q ON q.id = cb.presentacion_id AND q.empresa_id = cb.empresa_id
              WHERE cb.empresa_id = p.empresa_id AND cb.codigo = $3 AND q.producto_id = p.id) AS presentacion_escaneada
     ${FROM}
       AND (p.sku = $3 OR EXISTS (SELECT 1 FROM codigos_barras cb
                                   JOIN producto_presentaciones q ON q.id = cb.presentacion_id AND q.empresa_id = cb.empresa_id
                                   WHERE cb.empresa_id = p.empresa_id AND cb.codigo = $3 AND q.producto_id = p.id))
     LIMIT 1`,
    [empresaId, sucursalId, codigo]
  );
  const f = r.rows[0];
  return f && f.presentaciones.length ? f : null;
}