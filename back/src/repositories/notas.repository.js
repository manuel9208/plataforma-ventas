import { queSeVende, resolverCamposArticulo } from '@plataforma/calculos';
import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

// Los nombres de columna salen de esta lista, nunca del usuario
const COLUMNAS_SUGERENCIA = { marca: 'marca', talla: 'talla', color: 'color', modelo: 'modelo', textura: 'textura' };

// ---------- Configuración (la sucursal manda sobre la empresa) ----------
export async function cargarConfig(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ec.abono_porcentaje AS e_pct, ec.abono_es_minimo AS e_min, ec.campos_articulo AS e_campos,
            sc.abono_porcentaje AS s_pct, sc.abono_es_minimo AS s_min, sc.campos_articulo AS s_campos,
            ec.descuento_manual_max AS e_dmax, sc.descuento_manual_max AS s_dmax,
            sc.pin_entrega_activo AS s_pin, ec.pin_entrega_activo AS e_pin, e.tipo_negocio AS giro,
            ec.vende_productos AS e_vp, ec.vende_servicios AS e_vs, ec.vista_inicial AS e_vista,
            sc.vende_productos AS s_vp, sc.vende_servicios AS s_vs, sc.vista_inicial AS s_vista
     FROM empresas e
     LEFT JOIN empresa_config ec ON ec.empresa_id = e.id
     LEFT JOIN sucursal_config sc ON sc.empresa_id = e.id AND sc.sucursal_id = $2
     WHERE e.id = $1`,
    [empresaId, sucursalId]
  );
  const f = r.rows[0] ?? {};
  return {
    abonoPorcentaje: Number(f.s_pct ?? f.e_pct ?? 50),
    abonoEsMinimo: f.s_min ?? f.e_min ?? false,
    descuentoManualMax: Number(f.s_dmax ?? f.e_dmax ?? 20),
    camposArticulo: resolverCamposArticulo(f.e_campos, f.s_campos),
    pinEntregaActivo: f.s_pin ?? f.e_pin ?? true,
    ...queSeVende({
      giro: f.giro,
      empresa: { vendeProductos: f.e_vp, vendeServicios: f.e_vs, vistaInicial: f.e_vista },
      sucursal: { vendeProductos: f.s_vp, vendeServicios: f.s_vs, vistaInicial: f.s_vista },
    }),
  };
}

// ---------- Catálogo de servicios para la caja ----------
const FROM_SERVICIOS = `
  FROM servicios s
  JOIN departamentos d ON d.id = s.departamento_id AND d.empresa_id = s.empresa_id
  WHERE s.empresa_id = $1 AND s.activo AND d.activo
    AND EXISTS (SELECT 1 FROM servicio_sucursal ss
                WHERE ss.empresa_id = s.empresa_id AND ss.servicio_id = s.id AND ss.sucursal_id = $2 AND ss.activo)
    AND EXISTS (SELECT 1 FROM servicio_precios sp
                JOIN tipos_articulo ta ON ta.id = sp.tipo_articulo_id AND ta.empresa_id = sp.empresa_id AND ta.activo
                WHERE sp.empresa_id = s.empresa_id AND sp.servicio_id = s.id)`;

export async function listarServicios(db, empresaId, sucursalId, { buscar, ids, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursalId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro += ` AND (s.nombre ILIKE $${params.length} OR s.sku ILIKE $${params.length})`;
  }
  // Solo para uso interno del back (los artículos guardados del cliente); nunca viene de la URL
  if (ids?.length) {
    params.push(ids);
    filtro += ` AND s.id = ANY($${params.length}::bigint[])`;
  }
  const total = await db.query(`SELECT count(*) AS n ${FROM_SERVICIOS}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT s.id, s.departamento_id, s.sku, s.nombre, s.descripcion, s.tiempo_estimado_horas, d.nombre AS departamento,
            (SELECT t.porcentaje FROM tasas_iva t WHERE t.id = s.tasa_iva_id AND t.empresa_id = s.empresa_id) AS tasa,
            (SELECT COALESCE(json_agg(json_build_object(
                      'tipoArticuloId', ta.id, 'tipo', ta.nombre, 'precio', COALESCE(sps.precio, sp.precio))
                    ORDER BY ta.orden, ta.id), '[]'::json)
               FROM servicio_precios sp
               JOIN tipos_articulo ta ON ta.id = sp.tipo_articulo_id AND ta.empresa_id = sp.empresa_id AND ta.activo
               LEFT JOIN servicio_precio_sucursal sps
                 ON sps.servicio_id = sp.servicio_id AND sps.tipo_articulo_id = sp.tipo_articulo_id
                AND sps.empresa_id = sp.empresa_id AND sps.sucursal_id = $2
               WHERE sp.empresa_id = s.empresa_id AND sp.servicio_id = s.id) AS precios,
            (SELECT COALESCE(json_agg(json_build_object(
                      'id', x.id, 'nombre', x.nombre, 'precio', COALESCE(eps.precio, x.precio),
                      'tasa', (SELECT t2.porcentaje FROM tasas_iva t2 WHERE t2.id = x.tasa_iva_id AND t2.empresa_id = x.empresa_id))
                    ORDER BY x.nombre), '[]'::json)
               FROM servicio_extras se
               JOIN extras x ON x.id = se.extra_id AND x.empresa_id = se.empresa_id AND x.activo
               LEFT JOIN extra_precio_sucursal eps
                 ON eps.extra_id = x.id AND eps.empresa_id = x.empresa_id AND eps.sucursal_id = $2
               WHERE se.empresa_id = s.empresa_id AND se.servicio_id = s.id) AS extras
     ${FROM_SERVICIOS}${filtro}
     ORDER BY d.nombre, s.nombre, s.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

// ---------- Datos para validar y calcular la venta (siempre del servidor) ----------
export async function cargarServicios(db, empresaId, sucursalId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT s.id, s.departamento_id, s.sku, s.nombre, s.activo, s.tiempo_estimado_horas, d.activo AS departamento_activo,
            (SELECT t.porcentaje FROM tasas_iva t WHERE t.id = s.tasa_iva_id AND t.empresa_id = s.empresa_id) AS tasa,
            EXISTS (SELECT 1 FROM servicio_sucursal ss
                    WHERE ss.empresa_id = s.empresa_id AND ss.servicio_id = s.id AND ss.sucursal_id = $2 AND ss.activo) AS en_sucursal
     FROM servicios s
     JOIN departamentos d ON d.id = s.departamento_id AND d.empresa_id = s.empresa_id
     WHERE s.empresa_id = $1 AND s.id = ANY($3::bigint[])`,
    [empresaId, sucursalId, ids]
  );
  return r.rows;
}

// Precio de cada pareja servicio + tipo de artículo, con el precio propio de la sucursal si existe
export async function cargarPrecios(db, empresaId, sucursalId, servicioIds, tipoIds) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT x.servicio_id, x.tipo_id, sp.precio AS precio_general, sps.precio AS precio_sucursal,
            ta.nombre AS tipo_nombre, ta.activo AS tipo_activo
     FROM unnest($3::bigint[], $4::bigint[]) AS x(servicio_id, tipo_id)
     JOIN servicio_precios sp ON sp.empresa_id = $1 AND sp.servicio_id = x.servicio_id AND sp.tipo_articulo_id = x.tipo_id
     JOIN tipos_articulo ta ON ta.id = x.tipo_id AND ta.empresa_id = $1
     LEFT JOIN servicio_precio_sucursal sps
       ON sps.empresa_id = $1 AND sps.servicio_id = x.servicio_id AND sps.tipo_articulo_id = x.tipo_id AND sps.sucursal_id = $2`,
    [empresaId, sucursalId, servicioIds, tipoIds]
  );
  return r.rows;
}

export async function cargarExtras(db, empresaId, sucursalId, servicioIds, extraIds) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT se.servicio_id, x.id AS extra_id, x.nombre, x.activo, x.precio AS precio_general, eps.precio AS precio_sucursal,
            t.porcentaje AS tasa
     FROM servicio_extras se
     JOIN extras x ON x.id = se.extra_id AND x.empresa_id = se.empresa_id
     JOIN tasas_iva t ON t.id = x.tasa_iva_id AND t.empresa_id = x.empresa_id
     LEFT JOIN extra_precio_sucursal eps ON eps.extra_id = x.id AND eps.empresa_id = x.empresa_id AND eps.sucursal_id = $2
     WHERE se.empresa_id = $1 AND se.servicio_id = ANY($3::bigint[]) AND x.id = ANY($4::bigint[])`,
    [empresaId, sucursalId, servicioIds, extraIds]
  );
  return r.rows;
}

// ---------- Sugerencias de lo que ya se escribió (autocompletado) ----------
export async function sugerencias(db, empresaId, campo, buscar) {
  exigirEmpresa(empresaId);
  const columna = COLUMNAS_SUGERENCIA[campo];
  if (!columna) throw new Error('Campo no permitido');
  const params = [empresaId];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro = ` AND ${columna} ILIKE $2`;
  }
  const r = await db.query(
    `SELECT min(${columna}) AS valor, count(*) AS n
     FROM partida_articulos
     WHERE empresa_id = $1 AND ${columna} IS NOT NULL${filtro}
     GROUP BY lower(${columna})
     ORDER BY n DESC, valor LIMIT 8`,
    params
  );
  return r.rows.map((x) => x.valor);
}

// ---------- Guardar la nota ----------
export async function marcarNota(db, empresaId, ventaId, pinHash) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE ventas SET tiene_servicios = TRUE, pin_entrega_hash = $3 WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    ventaId,
    pinHash,
  ]);
}

// Inserta el servicio como partida, junto con su estado y los datos del artículo. Devuelve el id de la partida.
export async function insertarServicio(db, empresaId, s) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_partidas
       (empresa_id, venta_id, orden, tipo, nombre, sku, cantidad, precio_lista, precio_aplicado, origen_precio,
        tasa_iva, base, iva, total, promocion_id, promocion_nombre, descuento, descuento_origen,
        descuento_motivo, descuento_autorizado_por)
     VALUES ($1, $2, $3, 'servicio', $4, $5, 1, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id`,
    [
      empresaId, s.ventaId, s.orden, s.nombre, s.sku, s.precioLista, s.precioAplicado, s.origenPrecio, s.tasa, s.base, s.iva, s.total,
      s.promocionId ?? null, s.promocionNombre ?? null, s.descuento ?? 0, s.descuentoOrigen ?? null,
      s.descuentoMotivo ?? null, s.descuentoAutorizadoPor ?? null,
    ]
  );
  const id = r.rows[0].id;

  await db.query(
    `INSERT INTO partida_servicio
       (partida_id, empresa_id, servicio_id, tipo_articulo_id, tipo_articulo_nombre,
        fecha_prometida, fecha_prometida_original, recibido_por, sucursal_entrega_id, venta_articulo_id)
     VALUES ($1, $2, $3, $4, $5, $6::date, $6::date, $7, $8, $9)`,
    [id, empresaId, s.servicioId, s.tipoArticuloId, s.tipoNombre, s.fechaPrometida, s.usuarioId, s.sucursalId, s.articuloId ?? null]
  );

  const a = s.articulo;
  await db.query(
    `INSERT INTO partida_articulos (partida_id, empresa_id, marca, talla, color, modelo, textura, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, empresaId, a.marca, a.talla, a.color, a.modelo, a.textura, a.descripcion]
  );
  return id;
}

// Un artículo físico de la nota (puede llevar varios servicios). El id lo genera la base de datos.
export async function insertarArticuloNota(db, empresaId, a) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_articulos (empresa_id, venta_id, orden, comentario) VALUES ($1, $2, $3, $4) RETURNING id`,
    [empresaId, a.ventaId, a.orden, a.comentario]
  );
  return r.rows[0].id;
}

export async function insertarExtra(db, empresaId, x) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_partidas
       (empresa_id, venta_id, orden, tipo, nombre, cantidad, precio_lista, precio_aplicado, origen_precio,
        tasa_iva, base, iva, total)
     VALUES ($1, $2, $3, 'extra', $4, 1, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [empresaId, x.ventaId, x.orden, x.nombre, x.precioLista, x.precioAplicado, x.origenPrecio, x.tasa, x.base, x.iva, x.total]
  );
  await db.query(
    `INSERT INTO partida_extra (partida_id, empresa_id, padre_partida_id, extra_id) VALUES ($1, $2, $3, $4)`,
    [r.rows[0].id, empresaId, x.padreId, x.extraId]
  );
}

// ---------- Leer la nota ----------
export async function cargarNota(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const n = await db.query(
    `SELECT tiene_servicios, (pin_entrega_hash IS NOT NULL) AS tiene_pin FROM ventas WHERE empresa_id = $1 AND id = $2`,
    [empresaId, ventaId]
  );
  const tieneServicios = n.rows[0]?.tiene_servicios ?? false;
  if (!tieneServicios) return { tieneServicios: false, tienePin: false, servicios: [] };

  const s = await db.query(
    `SELECT vp.id, vp.orden, vp.tipo, vp.nombre, vp.total, vp.promocion_nombre, vp.descuento,
            ps.estado_trabajo, ps.fecha_prometida, ps.fecha_prometida_original, ps.tipo_articulo_nombre, ps.venta_articulo_id,
            va.comentario,
            pa.marca, pa.talla, pa.color, pa.modelo, pa.textura, pa.descripcion,
            pe.padre_partida_id
     FROM venta_partidas vp
     LEFT JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     LEFT JOIN partida_articulos pa ON pa.partida_id = vp.id AND pa.empresa_id = vp.empresa_id
     LEFT JOIN venta_articulos va ON va.id = ps.venta_articulo_id AND va.empresa_id = ps.empresa_id
     LEFT JOIN partida_extra pe ON pe.partida_id = vp.id AND pe.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = $2 AND vp.tipo IN ('servicio', 'extra')
     ORDER BY vp.orden`,
    [empresaId, ventaId]
  );
  return { tieneServicios: true, tienePin: n.rows[0].tiene_pin, servicios: s.rows };
}