import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

export async function listarSucursales(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, nombre, direccion, lat, lon FROM sucursales
     WHERE empresa_id = $1 AND activo ORDER BY nombre LIMIT 100`,
    [empresaId]
  );
  return r.rows;
}

export async function existeSucursal(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT 1 FROM sucursales WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, id]);
  return r.rowCount > 0;
}

// Productos activos, visibles y asignados a la sucursal, con el precio de esa sucursal
const FROM_PRODUCTOS = `
  FROM productos p
  JOIN departamentos d ON d.id = p.departamento_id AND d.empresa_id = p.empresa_id
  WHERE p.empresa_id = $1 AND p.activo AND p.visible_publico AND d.activo
    AND EXISTS (SELECT 1 FROM producto_sucursal x
                WHERE x.empresa_id = p.empresa_id AND x.producto_id = p.id
                  AND x.sucursal_id = $2 AND x.activo)`;

const PRECIOS_PRODUCTO = `
  (SELECT COALESCE(json_agg(json_build_object(
            'nombre', pp.nombre, 'precio', COALESCE(ps.precio, pp.precio))
          ORDER BY pp.es_base DESC, pp.id), '[]'::json)
     FROM producto_presentaciones pp
     LEFT JOIN presentacion_precio_sucursal ps
       ON ps.presentacion_id = pp.id AND ps.empresa_id = pp.empresa_id AND ps.sucursal_id = $2
     WHERE pp.empresa_id = p.empresa_id AND pp.producto_id = p.id AND pp.activo AND pp.se_vende
       AND COALESCE(ps.precio, pp.precio) IS NOT NULL) AS precios`;

export async function listarProductos(db, empresaId, sucursalId, { buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursalId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro = ` AND (p.nombre ILIKE $${params.length} OR p.marca ILIKE $${params.length})`;
  }
  const total = await db.query(`SELECT count(*) AS n ${FROM_PRODUCTOS}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT p.id, p.nombre, p.marca, p.descripcion, d.nombre AS departamento, ${PRECIOS_PRODUCTO}
     ${FROM_PRODUCTOS}${filtro}
     ORDER BY d.nombre, p.nombre, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

// Servicios activos, visibles y ofrecidos en la sucursal, con el precio por tipo de artículo
const FROM_SERVICIOS = `
  FROM servicios s
  JOIN departamentos d ON d.id = s.departamento_id AND d.empresa_id = s.empresa_id
  WHERE s.empresa_id = $1 AND s.activo AND s.visible_publico AND d.activo
    AND EXISTS (SELECT 1 FROM servicio_sucursal ss
                WHERE ss.empresa_id = s.empresa_id AND ss.servicio_id = s.id
                  AND ss.sucursal_id = $2 AND ss.activo)`;

const PRECIOS_SERVICIO = `
  (SELECT COALESCE(json_agg(json_build_object(
            'tipo', ta.nombre, 'precio', COALESCE(sps.precio, sp.precio))
          ORDER BY ta.orden, ta.id), '[]'::json)
     FROM servicio_precios sp
     JOIN tipos_articulo ta ON ta.id = sp.tipo_articulo_id AND ta.empresa_id = sp.empresa_id AND ta.activo
     LEFT JOIN servicio_precio_sucursal sps
       ON sps.servicio_id = sp.servicio_id AND sps.tipo_articulo_id = sp.tipo_articulo_id
      AND sps.empresa_id = sp.empresa_id AND sps.sucursal_id = $2
     WHERE sp.empresa_id = s.empresa_id AND sp.servicio_id = s.id) AS precios`;

export async function listarServicios(db, empresaId, sucursalId, { buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursalId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro = ` AND s.nombre ILIKE $${params.length}`;
  }
  const total = await db.query(`SELECT count(*) AS n ${FROM_SERVICIOS}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT s.id, s.nombre, s.descripcion, s.tiempo_estimado_horas, d.nombre AS departamento, ${PRECIOS_SERVICIO}
     ${FROM_SERVICIOS}${filtro}
     ORDER BY d.nombre, s.nombre, s.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}