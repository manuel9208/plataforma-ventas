import { exigirEmpresa } from '../utils/tenant.js';
import { SALDO_SQL, VALOR_SQL, PAGADO_SQL } from './notasLista.repository.js';

// Hora local de cada sucursal: el "día" de una venta es el de su sucursal, no el del servidor
const ZONA = `COALESCE(s.zona_horaria, e.zona_horaria)`;
const CANCELADA = `(v.total > 0 AND v.cancelado >= v.total)`;

// Los nombres de columna para ordenar salen de esta lista, nunca del usuario
const ORDENES = {
  fecha: 'v.creado_en',
  total: 'valor',
  abonado: 'abonado',
  pendiente: 'saldo',
  folio: 'v.folio',
  sucursal: 's.nombre',
  cliente: 'c.nombre',
};

const TABLAS_DINERO = { pagos: 'venta_pagos', reembolsos: 'venta_reembolsos' };

// Condición de cada estado (usa las columnas calculadas de FROM)
const ESTADOS = {
  pendientes: `${SALDO_SQL} > 0 AND NOT ${CANCELADA}`,
  liquidadas: `${SALDO_SQL} = 0 AND NOT ${CANCELADA}`,
  canceladas: CANCELADA,
  entregadas: `v.tiene_servicios AND (sv.en_espera + sv.listos) = 0 AND sv.entregados > 0`,
  por_entregar: `sv.listos > 0`,
};

// Una venta con todo lo que el reporte necesita, ya calculado
const FROM = `
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
  JOIN empresas e ON e.id = v.empresa_id
  JOIN usuarios u ON u.id = v.usuario_id AND u.empresa_id = v.empresa_id
  LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.monto), 0) AS pagado,
           COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'efectivo'), 0) AS efectivo,
           COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'tarjeta'), 0) AS tarjeta,
           COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'transferencia'), 0) AS transferencia
    FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
  ) pg ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(r.monto) FILTER (WHERE r.forma = 'efectivo'), 0) AS efectivo,
           COALESCE(sum(r.monto) FILTER (WHERE r.forma = 'tarjeta'), 0) AS tarjeta,
           COALESCE(sum(r.monto) FILTER (WHERE r.forma = 'transferencia'), 0) AS transferencia
    FROM venta_reembolsos r WHERE r.empresa_id = v.empresa_id AND r.venta_id = v.id
  ) rb ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(vp.descuento) FILTER (WHERE vp.descuento_origen = 'promocion'), 0) AS promo,
           COALESCE(sum(vp.descuento) FILTER (WHERE vp.descuento_origen = 'manual'), 0) AS manual,
           COALESCE(sum(vp.descuento_puntos), 0) AS puntos
    FROM venta_partidas vp WHERE vp.empresa_id = v.empresa_id AND vp.venta_id = v.id
  ) ds ON TRUE
  LEFT JOIN cupon_usos cu ON cu.empresa_id = v.empresa_id AND cu.venta_id = v.id AND cu.liberado_en IS NULL
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(ps.cargo_financiamiento), 0) AS financiamiento
    FROM partida_servicio ps
    JOIN venta_partidas x ON x.id = ps.partida_id AND x.empresa_id = ps.empresa_id
    WHERE x.empresa_id = v.empresa_id AND x.venta_id = v.id
  ) fi ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS articulos,
           count(*) FILTER (WHERE ps.estado_trabajo IN ('recibido', 'en_proceso')) AS en_espera,
           count(*) FILTER (WHERE ps.estado_trabajo = 'listo') AS listos,
           count(*) FILTER (WHERE ps.estado_trabajo = 'entregado') AS entregados,
           count(*) FILTER (WHERE ps.estado_trabajo = 'cancelado') AS cancelados,
           -- La fecha de lo pendiente; si ya se entregó todo, la de lo entregado (antes quedaba vacía)
           COALESCE(
             min(ps.fecha_prometida) FILTER (WHERE ps.estado_trabajo IN ('recibido', 'en_proceso', 'listo')),
             min(ps.fecha_prometida) FILTER (WHERE ps.estado_trabajo <> 'cancelado'),
             min(ps.fecha_prometida)
           ) AS prometida
    FROM venta_partidas vp
    JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
    WHERE vp.empresa_id = v.empresa_id AND vp.venta_id = v.id AND vp.tipo = 'servicio'
  ) sv ON TRUE`;

// $1 empresa, $2 sucursales, $3 desde, $4 hasta. El filtro de fechas va primero con un margen (usa el índice)
// y después exacto, con la hora de cada sucursal.
function filtro(f, params, { conEstado = true } = {}) {
  let sql = `
  WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[])
    AND v.creado_en >= ($3::date - 1) AND v.creado_en < ($4::date + 2)
    AND (v.creado_en AT TIME ZONE ${ZONA})::date BETWEEN $3::date AND $4::date`;
  if (f.giro === 'servicios') sql += ' AND v.tiene_servicios';
  if (f.giro === 'productos') sql += ' AND NOT v.tiene_servicios';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    sql += ` AND v.usuario_id = $${params.length}`;
  }
  if (conEstado && ESTADOS[f.estado]) sql += ` AND (${ESTADOS[f.estado]})`;
  return sql;
}

const base = (empresaId, sucursales, f) => [empresaId, sucursales, f.desde, f.hasta];

export async function listar(db, empresaId, sucursales, f, { orden, direccion, limite, pagina }) {
  exigirEmpresa(empresaId);
  const columna = ORDENES[orden] ?? ORDENES.fecha;
  const sentido = direccion === 'asc' ? 'ASC' : 'DESC';
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  params.push(limite, (pagina - 1) * limite);

  const r = await db.query(
    `SELECT v.id, v.folio, v.tiene_servicios, v.total, v.cancelado, v.ajustado, v.retenido, v.reembolsado, v.iva, v.financiada, v.creado_en,
            v.sucursal_id, s.nombre AS sucursal, ${ZONA} AS zona, u.nombre AS cajero,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            ${VALOR_SQL} AS valor, ${PAGADO_SQL} AS abonado, ${SALDO_SQL} AS saldo,
            (pg.efectivo - rb.efectivo) AS efectivo, (pg.tarjeta - rb.tarjeta) AS tarjeta, (pg.transferencia - rb.transferencia) AS transferencia,
            ds.promo AS descuento_promocion, ds.manual AS descuento_manual, ds.puntos AS puntos_usados,
            COALESCE(cu.descuento, 0) AS descuento_cupon, fi.financiamiento,
            sv.articulos, sv.en_espera, sv.listos, sv.entregados, sv.cancelados,
            to_char(sv.prometida, 'YYYY-MM-DD') AS prometida,
            (SELECT max(en.creado_en) FROM venta_entregas en
             WHERE en.empresa_id = v.empresa_id AND en.venta_id = v.id) AS entregada_en
     ${FROM} ${where}
     ORDER BY ${columna} ${sentido}, v.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

// Una fila por sucursal con todas las sumas de lo filtrado (no solo de la página que se ve)
export async function totalesPorSucursal(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  const r = await db.query(
    `SELECT v.sucursal_id, count(*) AS notas,
            COALESCE(sum(${VALOR_SQL}), 0) AS vendido,
            COALESCE(sum(${VALOR_SQL}) FILTER (WHERE v.tiene_servicios), 0) AS vendido_notas,
            COALESCE(sum(${VALOR_SQL}) FILTER (WHERE NOT v.tiene_servicios), 0) AS vendido_ventas,
            COALESCE(sum(${PAGADO_SQL}), 0) AS abonado,
            COALESCE(sum(${SALDO_SQL}) FILTER (WHERE NOT ${CANCELADA}), 0) AS pendiente,
            COALESCE(sum(v.iva), 0) AS iva,
            COALESCE(sum(ds.promo), 0) AS descuento_promocion,
            COALESCE(sum(ds.manual), 0) AS descuento_manual,
            COALESCE(sum(cu.descuento), 0) AS descuento_cupon,
            COALESCE(sum(ds.puntos), 0) AS puntos_usados,
            COALESCE(sum(fi.financiamiento), 0) AS financiamiento,
            count(*) FILTER (WHERE ${CANCELADA}) AS canceladas
     ${FROM} ${where}
     GROUP BY v.sucursal_id`,
    params
  );
  return r.rows;
}

// Dinero que se cobró (o se devolvió) en el periodo, aunque sea de notas de otros días. El empleado es quien lo recibió.
export async function dineroPorForma(db, empresaId, sucursales, f, cual) {
  exigirEmpresa(empresaId);
  const tabla = TABLAS_DINERO[cual];
  if (!tabla) throw new Error('Tabla no permitida');
  const params = base(empresaId, sucursales, f);
  let extra = '';
  if (f.giro === 'servicios') extra += ' AND v.tiene_servicios';
  if (f.giro === 'productos') extra += ' AND NOT v.tiene_servicios';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    extra += ` AND m.usuario_id = $${params.length}`;
  }
  const r = await db.query(
    `SELECT v.sucursal_id, m.forma, COALESCE(sum(m.monto), 0) AS monto
     FROM ${tabla} m
     JOIN ventas v ON v.id = m.venta_id AND v.empresa_id = m.empresa_id
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     WHERE m.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[])
       AND m.creado_en >= ($3::date - 1) AND m.creado_en < ($4::date + 2)
       AND (m.creado_en AT TIME ZONE ${ZONA})::date BETWEEN $3::date AND $4::date${extra}
     GROUP BY v.sucursal_id, m.forma`,
    params
  );
  return r.rows;
}

// Lo que todavía deben las notas creadas ANTES del periodo
export async function porCobrarAnteriores(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales, f.desde];
  let extra = '';
  if (f.giro === 'servicios') extra += ' AND v.tiene_servicios';
  if (f.giro === 'productos') extra += ' AND NOT v.tiene_servicios';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    extra += ` AND v.usuario_id = $${params.length}`;
  }
  const r = await db.query(
    `SELECT count(*) AS notas, COALESCE(sum(${SALDO_SQL}), 0) AS monto
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(sum(p.monto), 0) AS pagado FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
     ) pg ON TRUE
     WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[]) AND v.tiene_servicios
       AND v.creado_en < ($3::date + 1)
       AND (v.creado_en AT TIME ZONE ${ZONA})::date < $3::date
       AND ${SALDO_SQL} > 0 AND NOT ${CANCELADA}${extra}`,
    params
  );
  return { notas: Number(r.rows[0].notas), monto: Number(r.rows[0].monto) };
}

// Empleados que se pueden elegir en el filtro (incluye los dados de baja: pudieron vender antes)
export async function listarEmpleados(db, empresaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT DISTINCT u.id, u.nombre, u.activo
     FROM usuarios u
     JOIN usuario_sucursales us ON us.usuario_id = u.id AND us.empresa_id = u.empresa_id
     WHERE u.empresa_id = $1 AND us.sucursal_id = ANY($2::bigint[])
     ORDER BY u.nombre LIMIT 300`,
    [empresaId, sucursales]
  );
  return r.rows;
}

// Ventas y número de notas de cada hora del día (hora local de cada sucursal), sumando todos los días del periodo
export async function ventasPorHora(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  const r = await db.query(
    `SELECT EXTRACT(HOUR FROM (v.creado_en AT TIME ZONE ${ZONA}))::int AS hora,
            count(*) AS notas, COALESCE(sum(${VALOR_SQL}), 0) AS vendido
     ${FROM} ${where}
     GROUP BY 1`,
    params
  );
  return r.rows;
}

// Porcentaje de crecimiento de cada sucursal (la sucursal manda sobre la empresa)
export async function metasCrecimiento(db, empresaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT s.id AS sucursal_id, COALESCE(sc.meta_crecimiento, ec.meta_crecimiento, 5) AS porcentaje
     FROM sucursales s
     LEFT JOIN empresa_config ec ON ec.empresa_id = s.empresa_id
     LEFT JOIN sucursal_config sc ON sc.empresa_id = s.empresa_id AND sc.sucursal_id = s.id
     WHERE s.empresa_id = $1 AND s.id = ANY($2::bigint[])`,
    [empresaId, sucursales]
  );
  return r.rows;
}

// Horario de cada sucursal (la sucursal manda sobre la empresa)
export async function horariosDeSucursales(db, empresaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT s.id AS sucursal_id, COALESCE(sc.horario, ec.horario) AS horario,
            COALESCE(sc.dias_especiales, ec.dias_especiales) AS especiales
     FROM sucursales s
     LEFT JOIN empresa_config ec ON ec.empresa_id = s.empresa_id
     LEFT JOIN sucursal_config sc ON sc.empresa_id = s.empresa_id AND sc.sucursal_id = s.id
     WHERE s.empresa_id = $1 AND s.id = ANY($2::bigint[])`,
    [empresaId, sucursales]
  );
  return r.rows.map((x) => ({ sucursalId: Number(x.sucursal_id), horario: x.horario, especiales: x.especiales }));
}

// ---------- Lo que no se vendió ----------
const LIMITE_SIN_VENTAS = 50;

// Ventas vigentes (no canceladas ni devueltas) de las sucursales elegidas en el periodo
const VENTA_DEL_PERIODO = `
  JOIN ventas v ON v.id = vp.venta_id AND v.empresa_id = vp.empresa_id
  JOIN sucursales su ON su.id = v.sucursal_id AND su.empresa_id = v.empresa_id
  JOIN empresas em ON em.id = v.empresa_id
  WHERE vp.empresa_id = $1 AND vp.ajuste_id IS NULL AND v.sucursal_id = ANY($2::bigint[])
    AND v.creado_en >= ($3::date - 1) AND v.creado_en < ($4::date + 2)
    AND (v.creado_en AT TIME ZONE COALESCE(su.zona_horaria, em.zona_horaria))::date BETWEEN $3::date AND $4::date`;

// Productos y servicios activos de esas sucursales sin ninguna venta en el periodo.
// Devuelve hasta 50 de cada uno y el total.
export async function sinVentas(db, empresaId, sucursales, f, { productos, servicios }) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  let empleado = '';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    empleado = ` AND v.usuario_id = $${params.length}`;
  }

  const consultar = async (sql) => {
    const r = await db.query(sql, params);
    return {
      total: r.rows.length ? Number(r.rows[0].total) : 0,
      filas: r.rows.map((x) => ({ id: Number(x.id), nombre: x.nombre, sku: x.sku, departamento: x.departamento })),
    };
  };

  const vacio = { total: 0, filas: [] };
  return {
    productos: productos
      ? await consultar(
          `SELECT p.id, p.nombre, p.sku, d.nombre AS departamento, count(*) OVER() AS total
           FROM productos p
           JOIN departamentos d ON d.id = p.departamento_id AND d.empresa_id = p.empresa_id
           WHERE p.empresa_id = $1 AND p.activo AND d.activo
             AND EXISTS (SELECT 1 FROM producto_sucursal x
                         WHERE x.empresa_id = p.empresa_id AND x.producto_id = p.id AND x.activo AND x.sucursal_id = ANY($2::bigint[]))
             AND NOT EXISTS (SELECT 1 FROM venta_partidas vp ${VENTA_DEL_PERIODO} AND vp.producto_id = p.id${empleado})
           ORDER BY d.nombre, p.nombre, p.id LIMIT ${LIMITE_SIN_VENTAS}`
        )
      : vacio,
    servicios: servicios
      ? await consultar(
          `SELECT sv.id, sv.nombre, sv.sku, d.nombre AS departamento, count(*) OVER() AS total
           FROM servicios sv
           JOIN departamentos d ON d.id = sv.departamento_id AND d.empresa_id = sv.empresa_id
           WHERE sv.empresa_id = $1 AND sv.activo AND d.activo
             AND EXISTS (SELECT 1 FROM servicio_sucursal x
                         WHERE x.empresa_id = sv.empresa_id AND x.servicio_id = sv.id AND x.activo AND x.sucursal_id = ANY($2::bigint[]))
             AND NOT EXISTS (SELECT 1 FROM venta_partidas vp
                             JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
                             ${VENTA_DEL_PERIODO} AND ps.servicio_id = sv.id${empleado})
           ORDER BY d.nombre, sv.nombre, sv.id LIMIT ${LIMITE_SIN_VENTAS}`
        )
      : vacio,
  };
}

// ---------- Consumo: lo que se vendió, pieza por pieza ----------
const LIMITE_CONSUMO = 100;
// Los nombres para ordenar salen de esta lista, nunca del usuario
const ORDENES_CONSUMO = { cantidad: 'cantidad DESC, dinero DESC', dinero: 'dinero DESC, cantidad DESC' };

// Las ventas que cumplen los filtros del reporte: la misma lista que la tabla
const ventasFiltradas = (f, params) => `WITH vf AS (SELECT v.id ${FROM} ${filtro(f, params)})`;

// Un renglón cancelado o devuelto completo tiene ajuste_id; una devolución parcial se resta de la cantidad y del valor
export async function consumoProductos(db, empresaId, sucursales, f, orden) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `${ventasFiltradas(f, params)}
     SELECT vp.presentacion_id AS id, max(vp.nombre) AS nombre, max(vp.unidad) AS unidad,
            COALESCE(sum(vp.cantidad - vp.cantidad_devuelta), 0) AS cantidad,
            COALESCE(sum(vp.total - vp.valor_devuelto), 0) AS dinero,
            count(DISTINCT vp.venta_id) AS notas,
            count(*) OVER () AS renglones,
            sum(sum(vp.total - vp.valor_devuelto)) OVER () AS dinero_total
     FROM venta_partidas vp
     JOIN vf ON vf.id = vp.venta_id
     WHERE vp.empresa_id = $1 AND vp.tipo = 'producto' AND vp.ajuste_id IS NULL
     GROUP BY vp.presentacion_id
     HAVING sum(vp.cantidad - vp.cantidad_devuelta) > 0
     ORDER BY ${ORDENES_CONSUMO[orden] ?? ORDENES_CONSUMO.cantidad}, 2
     LIMIT ${LIMITE_CONSUMO}`,
    params
  );
  return r.rows;
}

// Una fila por servicio y tipo de artículo, y una fila de total por servicio (es_total = 1)
export async function consumoServicios(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `${ventasFiltradas(f, params)}
     SELECT ps.servicio_id AS id, max(s.nombre) AS nombre, ps.tipo_articulo_nombre AS tipo,
            GROUPING(ps.tipo_articulo_nombre) AS es_total,
            count(*) AS cantidad,
            COALESCE(sum(vp.total - ps.cargo_financiamiento), 0) AS dinero,
            count(DISTINCT vp.venta_id) AS notas
     FROM venta_partidas vp
     JOIN vf ON vf.id = vp.venta_id
     JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     JOIN servicios s ON s.id = ps.servicio_id AND s.empresa_id = ps.empresa_id
     WHERE vp.empresa_id = $1 AND vp.tipo = 'servicio' AND vp.ajuste_id IS NULL AND ps.estado_trabajo <> 'cancelado'
     GROUP BY GROUPING SETS ((ps.servicio_id, ps.tipo_articulo_nombre), (ps.servicio_id))`,
    params
  );
  return r.rows;
}

export async function consumoExtras(db, empresaId, sucursales, f, orden) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `${ventasFiltradas(f, params)}
     SELECT pe.extra_id AS id, max(vp.nombre) AS nombre,
            count(*) AS cantidad, COALESCE(sum(vp.total), 0) AS dinero,
            count(DISTINCT vp.venta_id) AS notas,
            count(*) OVER () AS renglones,
            sum(sum(vp.total)) OVER () AS dinero_total
     FROM venta_partidas vp
     JOIN vf ON vf.id = vp.venta_id
     JOIN partida_extra pe ON pe.partida_id = vp.id AND pe.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.tipo = 'extra' AND vp.ajuste_id IS NULL
     GROUP BY pe.extra_id
     ORDER BY ${ORDENES_CONSUMO[orden] ?? ORDENES_CONSUMO.cantidad}, 2
     LIMIT ${LIMITE_CONSUMO}`,
    params
  );
  return r.rows;
}

// Lo que consumió cada nota de la página (para la columna "Qué consumió")
export async function resumenArticulos(db, empresaId, ventaIds) {
  exigirEmpresa(empresaId);
  if (!ventaIds.length) return [];
  const r = await db.query(
    `SELECT vp.venta_id, vp.tipo, vp.nombre, vp.cantidad - vp.cantidad_devuelta AS cantidad
     FROM venta_partidas vp
     WHERE vp.empresa_id = $1 AND vp.venta_id = ANY($2::uuid[]) AND vp.tipo IN ('producto', 'servicio') AND vp.ajuste_id IS NULL
     ORDER BY vp.venta_id, vp.orden`,
    [empresaId, ventaIds]
  );
  return r.rows;
}

// Una nota con todo lo que consumió, solo si es de una sucursal del usuario
export async function detalleDeVenta(db, empresaId, sucursales, ventaId) {
  exigirEmpresa(empresaId);
  const v = await db.query(
    `SELECT v.id, v.folio, v.tiene_servicios, v.total, v.cancelado, v.creado_en,
            s.nombre AS sucursal, ${ZONA} AS zona, u.nombre AS cajero,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     JOIN usuarios u ON u.id = v.usuario_id AND u.empresa_id = v.empresa_id
     LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
     WHERE v.empresa_id = $1 AND v.id = $2 AND v.sucursal_id = ANY($3::bigint[])`,
    [empresaId, ventaId, sucursales]
  );
  if (!v.rows[0]) return null;

  const p = await db.query(
    `SELECT vp.id, vp.orden, vp.tipo, vp.nombre, vp.unidad, vp.cantidad, vp.cantidad_devuelta, vp.total, vp.valor_devuelto,
            (vp.ajuste_id IS NOT NULL) AS quitado,
            ps.estado_trabajo, ps.venta_articulo_id, ps.cargo_financiamiento,
            va.comentario, pa.marca, pa.talla, pa.color, pa.modelo, pa.textura, pa.descripcion,
            pe.padre_partida_id
     FROM venta_partidas vp
     LEFT JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     LEFT JOIN partida_articulos pa ON pa.partida_id = vp.id AND pa.empresa_id = vp.empresa_id
     LEFT JOIN venta_articulos va ON va.id = ps.venta_articulo_id AND va.empresa_id = ps.empresa_id
     LEFT JOIN partida_extra pe ON pe.partida_id = vp.id AND pe.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = $2
     ORDER BY vp.orden`,
    [empresaId, ventaId]
  );
  return { venta: v.rows[0], partidas: p.rows };
}

// ---------- Análisis ----------
export async function ventasPorEmpleado(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  const r = await db.query(
    `SELECT v.usuario_id AS id, max(u.nombre) AS nombre, count(*) AS notas,
            count(*) FILTER (WHERE ${CANCELADA}) AS canceladas,
            COALESCE(sum(${VALOR_SQL}), 0) AS vendido,
            COALESCE(sum(${SALDO_SQL}) FILTER (WHERE NOT ${CANCELADA}), 0) AS pendiente
     ${FROM} ${where}
     GROUP BY v.usuario_id
     ORDER BY vendido DESC, nombre
     LIMIT 50`,
    params
  );
  return r.rows;
}

// Día de la semana según la hora local de cada sucursal (ISO: 1 = lunes … 7 = domingo)
export async function ventasPorDiaSemana(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  const r = await db.query(
    `SELECT EXTRACT(ISODOW FROM (v.creado_en AT TIME ZONE ${ZONA}))::int AS dia,
            count(*) AS notas, COALESCE(sum(${VALOR_SQL}), 0) AS vendido
     ${FROM} ${where}
     GROUP BY 1`,
    params
  );
  return r.rows;
}

// "Nuevo" = su registro se creó dentro del periodo
const CLIENTE_NUEVO = `(c.creado_en AT TIME ZONE ${ZONA})::date BETWEEN $3::date AND $4::date`;

export async function clientesDelPeriodo(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const where = filtro(f, params);
  const r = await db.query(
    `SELECT count(*) FILTER (WHERE v.cliente_id IS NULL) AS sin_cliente,
            COALESCE(sum(${VALOR_SQL}) FILTER (WHERE v.cliente_id IS NULL), 0) AS vendido_sin_cliente,
            count(DISTINCT v.cliente_id) FILTER (WHERE v.cliente_id IS NOT NULL AND ${CLIENTE_NUEVO}) AS nuevos,
            COALESCE(sum(${VALOR_SQL}) FILTER (WHERE v.cliente_id IS NOT NULL AND ${CLIENTE_NUEVO}), 0) AS vendido_nuevos,
            count(DISTINCT v.cliente_id) FILTER (WHERE v.cliente_id IS NOT NULL AND NOT ${CLIENTE_NUEVO}) AS recurrentes,
            COALESCE(sum(${VALOR_SQL}) FILTER (WHERE v.cliente_id IS NOT NULL AND NOT ${CLIENTE_NUEVO}), 0) AS vendido_recurrentes
     ${FROM} ${where}`,
    params
  );
  return r.rows[0] ?? {};
}

// Cancelaciones, devoluciones y reembolsos hechos en el periodo (por la fecha en que se hicieron).
// El empleado es quien los hizo; el estado de la nota no aplica aquí.
function filtroAjustes(f, params) {
  let sql = `
  FROM venta_ajustes a
  JOIN ventas v ON v.id = a.venta_id AND v.empresa_id = a.empresa_id
  JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
  JOIN empresas e ON e.id = v.empresa_id
  WHERE a.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[])
    AND a.creado_en >= ($3::date - 1) AND a.creado_en < ($4::date + 2)
    AND (a.creado_en AT TIME ZONE ${ZONA})::date BETWEEN $3::date AND $4::date`;
  if (f.giro === 'servicios') sql += ' AND v.tiene_servicios';
  if (f.giro === 'productos') sql += ' AND NOT v.tiene_servicios';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    sql += ` AND a.usuario_id = $${params.length}`;
  }
  return sql;
}

export async function ajustesDelPeriodo(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `SELECT a.tipo, v.tiene_servicios, count(*) AS operaciones,
            COALESCE(sum(a.valor_cancelado), 0) AS cancelado,
            COALESCE(sum(a.devuelto), 0) AS devuelto,
            COALESCE(sum(a.retenido), 0) AS retenido
     ${filtroAjustes(f, params)}
     GROUP BY a.tipo, v.tiene_servicios`,
    params
  );
  return r.rows;
}

// Los motivos que más se repiten (el motivo es texto libre: se juntan sin importar mayúsculas)
export async function motivosDeAjustes(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `SELECT min(a.motivo) AS motivo, count(*) AS veces, COALESCE(sum(a.devuelto), 0) AS devuelto
     ${filtroAjustes(f, params)}
     GROUP BY lower(btrim(a.motivo))
     ORDER BY veces DESC, 1
     LIMIT 5`,
    params
  );
  return r.rows;
}

// Lo que se debe HOY: no depende del periodo ni del estado, solo de las sucursales (y del empleado si se eligió)
const EDAD_EN_DIAS = `((now() AT TIME ZONE ${ZONA})::date - (v.creado_en AT TIME ZONE ${ZONA})::date)`;
const NOTAS_CON_SALDO = (extra) => `
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
  JOIN empresas e ON e.id = v.empresa_id
  LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.monto), 0) AS pagado FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
  ) pg ON TRUE
  WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[]) AND v.tiene_servicios
    AND NOT ${CANCELADA} AND ${SALDO_SQL} > 0${extra}`;

export async function cobranzaActual(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let extra = '';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    extra = ` AND v.usuario_id = $3`;
  }
  const [porEdad, masAtrasadas] = await Promise.all([
    db.query(
      `SELECT ${EDAD_EN_DIAS} AS dias, count(*) AS notas, COALESCE(sum(${SALDO_SQL}), 0) AS monto
       ${NOTAS_CON_SALDO(extra)} GROUP BY 1`,
      params
    ),
    db.query(
      `SELECT v.id, v.folio, s.nombre AS sucursal, c.nombre AS cliente, c.telefono,
              ${SALDO_SQL} AS saldo, ${EDAD_EN_DIAS} AS dias
       ${NOTAS_CON_SALDO(extra)}
       ORDER BY dias DESC, saldo DESC, v.id
       LIMIT 10`,
      params
    ),
  ]);
  return { porEdad: porEdad.rows, masAtrasadas: masAtrasadas.rows };
}

// Descuentos de lo vigente: por promoción y los manuales por quien los autorizó
export async function descuentosDados(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const r = await db.query(
    `${ventasFiltradas(f, params)}
     SELECT vp.descuento_origen AS origen, vp.promocion_nombre AS nombre,
            vp.descuento_autorizado_por AS autorizo_id, max(u.nombre) AS autorizo_nombre,
            count(*) AS lineas, COALESCE(sum(vp.descuento), 0) AS descuento
     FROM venta_partidas vp
     JOIN vf ON vf.id = vp.venta_id
     LEFT JOIN usuarios u ON u.id = vp.descuento_autorizado_por AND u.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.descuento > 0 AND vp.ajuste_id IS NULL
     GROUP BY vp.descuento_origen, vp.promocion_nombre, vp.descuento_autorizado_por
     ORDER BY descuento DESC
     LIMIT 100`,
    params
  );
  return r.rows;
}

// Zona horaria de una sucursal (para escribir la hora en que se generó el reporte)
export async function zonaDeSucursal(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(s.zona_horaria, e.zona_horaria) AS zona
     FROM sucursales s JOIN empresas e ON e.id = s.empresa_id
     WHERE s.empresa_id = $1 AND s.id = $2`,
    [empresaId, sucursalId]
  );
  return r.rows[0]?.zona ?? 'UTC';
}

// ---------- Cobros de notas de días anteriores ----------
// Notas creadas ANTES del periodo que recibieron dinero DENTRO del periodo (liquidaciones y abonos).
// Mismas reglas que "Dinero que entró": cuenta la fecha del pago, el empleado es quien lo recibió y el estado no aplica.
function cobrosAnterioresCte(f, params) {
  let extra = '';
  if (f.giro === 'servicios') extra += ' AND v.tiene_servicios';
  if (f.giro === 'productos') extra += ' AND NOT v.tiene_servicios';
  if (f.empleadoId) {
    params.push(f.empleadoId);
    extra += ` AND m.usuario_id = $${params.length}`;
  }
  return `
  WITH ca AS (
    SELECT m.venta_id,
           COALESCE(sum(m.monto), 0) AS cobrado,
           COALESCE(sum(m.monto) FILTER (WHERE m.forma = 'efectivo'), 0) AS efectivo,
           COALESCE(sum(m.monto) FILTER (WHERE m.forma = 'tarjeta'), 0) AS tarjeta,
           COALESCE(sum(m.monto) FILTER (WHERE m.forma = 'transferencia'), 0) AS transferencia,
           count(*) AS pagos,
           max(m.creado_en) AS ultimo_cobro
    FROM venta_pagos m
    JOIN ventas v ON v.id = m.venta_id AND v.empresa_id = m.empresa_id
    JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
    JOIN empresas e ON e.id = v.empresa_id
    WHERE m.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[])
      AND m.creado_en >= ($3::date - 1) AND m.creado_en < ($4::date + 2)
      AND (m.creado_en AT TIME ZONE ${ZONA})::date BETWEEN $3::date AND $4::date
      AND v.creado_en < ($3::date + 1)
      AND (v.creado_en AT TIME ZONE ${ZONA})::date < $3::date${extra}
    GROUP BY m.venta_id
  )`;
}

// Solo las notas cobradas (la condición sobre v.id hace que lo pesado se calcule únicamente para ellas)
const SOLO_COBRADAS = `
  JOIN ca ON ca.venta_id = v.id
  WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[]) AND v.id = ANY(ARRAY(SELECT venta_id FROM ca))`;

export async function listarCobrosAnteriores(db, empresaId, sucursales, f, { limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const cte = cobrosAnterioresCte(f, params);
  params.push(limite, (pagina - 1) * limite);
  const r = await db.query(
    `${cte}
     SELECT v.id, v.folio, v.creado_en, s.nombre AS sucursal, ${ZONA} AS zona,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            ${VALOR_SQL} AS valor, ${PAGADO_SQL} AS abonado, ${SALDO_SQL} AS saldo, ${CANCELADA} AS cancelada,
            pp.monto AS primer_monto, pp.efectivo AS primer_efectivo, pp.tarjeta AS primer_tarjeta,
            pp.transferencia AS primer_transferencia, pp.fecha AS primer_fecha,
            ca.cobrado, ca.efectivo AS cobrado_efectivo, ca.tarjeta AS cobrado_tarjeta,
            ca.transferencia AS cobrado_transferencia, ca.pagos, ca.ultimo_cobro,
            up.ultimo_pago, ve.entregada_en,
            to_char(sv.prometida, 'YYYY-MM-DD') AS prometida
     ${FROM}
     -- Primer pago: lo que se pagó el mismo día en que se dejó la nota (hora de la sucursal)
     LEFT JOIN LATERAL (
       SELECT COALESCE(sum(p.monto), 0) AS monto,
              COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'efectivo'), 0) AS efectivo,
              COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'tarjeta'), 0) AS tarjeta,
              COALESCE(sum(p.monto) FILTER (WHERE p.forma = 'transferencia'), 0) AS transferencia,
              min(p.creado_en) AS fecha
       FROM venta_pagos p
       WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
         AND (p.creado_en AT TIME ZONE ${ZONA})::date = (v.creado_en AT TIME ZONE ${ZONA})::date
     ) pp ON TRUE
     LEFT JOIN LATERAL (
       SELECT max(p.creado_en) AS ultimo_pago
       FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
     ) up ON TRUE
     LEFT JOIN LATERAL (
       SELECT max(en.creado_en) AS entregada_en
       FROM venta_entregas en WHERE en.empresa_id = v.empresa_id AND en.venta_id = v.id
     ) ve ON TRUE
     ${SOLO_COBRADAS}
     ORDER BY ca.ultimo_cobro DESC, v.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

// Totales de todas las notas cobradas (no solo de la página que se ve)
export async function resumenCobrosAnteriores(db, empresaId, sucursales, f) {
  exigirEmpresa(empresaId);
  const params = base(empresaId, sucursales, f);
  const cte = cobrosAnterioresCte(f, params);
  const r = await db.query(
    `${cte}
     SELECT count(*) AS notas,
            count(*) FILTER (WHERE ${SALDO_SQL} <= 0 AND NOT ${CANCELADA}) AS liquidadas,
            COALESCE(sum(ca.cobrado), 0) AS monto,
            COALESCE(sum(ca.efectivo), 0) AS efectivo,
            COALESCE(sum(ca.tarjeta), 0) AS tarjeta,
            COALESCE(sum(ca.transferencia), 0) AS transferencia
     ${FROM}
     ${SOLO_COBRADAS}`,
    params
  );
  return r.rows[0] ?? {};
}