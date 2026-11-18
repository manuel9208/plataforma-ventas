import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;
const ZONA = 'COALESCE(s.zona_horaria, e.zona_horaria)';

// Ventas de solo productos (las notas de servicio van en su propia lista)
const DESDE = `
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
  JOIN empresas e ON e.id = v.empresa_id
  JOIN cajas cj ON cj.id = v.caja_id AND cj.empresa_id = v.empresa_id
  JOIN usuarios u ON u.id = v.usuario_id AND u.empresa_id = v.empresa_id
  LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id`;

// turnoId (si viene) limita la lista a las ventas de ese turno
export async function listar(db, empresaId, sucursales, { turnoId, desde, hasta, buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';
  if (turnoId) {
    params.push(turnoId);
    filtro += ` AND v.turno_id = $${params.length}`;
  }
  if (desde) {
    params.push(desde);
    filtro += ` AND (v.creado_en AT TIME ZONE ${ZONA})::date >= $${params.length}::date`;
  }
  if (hasta) {
    params.push(hasta);
    filtro += ` AND (v.creado_en AT TIME ZONE ${ZONA})::date <= $${params.length}::date`;
  }
  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro += ` AND (v.folio ILIKE $${n} OR c.nombre ILIKE $${n} OR c.telefono LIKE $${n})`;
  }
  const donde = ` WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[]) AND NOT v.tiene_servicios${filtro}`;

  const total = await db.query(`SELECT count(*) AS n ${DESDE}${donde}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT v.id, v.folio, v.total, v.cancelado, v.reembolsado, v.creado_en,
            s.nombre AS sucursal, cj.nombre AS caja, u.nombre AS cajero, ${ZONA} AS zona,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            (SELECT count(*) FROM venta_partidas vp WHERE vp.empresa_id = v.empresa_id AND vp.venta_id = v.id) AS articulos
     ${DESDE}${donde}
     ORDER BY v.creado_en DESC, v.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

// Una venta de mostrador, solo si es de una sucursal permitida
export async function obtener(db, empresaId, sucursales, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.sucursal_id, v.turno_id, v.folio, v.total, v.subtotal, v.iva, v.precios_incluyen_iva,
            v.cancelado, v.reembolsado, v.creado_en,
            s.nombre AS sucursal_nombre, ${ZONA} AS zona, e.nombre AS empresa_nombre,
            cj.nombre AS caja_nombre, u.nombre AS cajero_nombre,
            c.id AS cliente_id, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     ${DESDE}
     WHERE v.empresa_id = $1 AND v.id = $2 AND v.sucursal_id = ANY($3::bigint[]) AND NOT v.tiene_servicios`,
    [empresaId, id, sucursales]
  );
  return r.rows[0] || null;
}

export async function listarProductos(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, orden, nombre, unidad, cantidad, precio_aplicado, origen_precio, total, cantidad_devuelta, valor_devuelto
     FROM venta_partidas WHERE empresa_id = $1 AND venta_id = $2 AND tipo = 'producto' ORDER BY orden`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// Datos mínimos para decidir si esta persona puede trabajar con la venta (sin bloquear nada)
export async function datosBasicos(db, empresaId, ventaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, sucursal_id, turno_id, tiene_servicios FROM ventas WHERE empresa_id = $1 AND id = $2 AND sucursal_id = ANY($3::bigint[])`,
    [empresaId, ventaId, sucursales]
  );
  return r.rows[0] || null;
}

// Partidas bloqueadas mientras dura la devolución
export async function partidasParaDevolver(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, tipo, nombre, unidad, cantidad, cantidad_devuelta, total, valor_devuelto, ajuste_id
     FROM venta_partidas WHERE empresa_id = $1 AND venta_id = $2 ORDER BY orden FOR UPDATE`,
    [empresaId, ventaId]
  );
  return r.rows;
}

export async function registrarDevolucion(db, empresaId, x) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO venta_devoluciones (empresa_id, ajuste_id, venta_id, partida_id, cantidad, valor) VALUES ($1, $2, $3, $4, $5, $6)`,
    [empresaId, x.ajusteId, x.ventaId, x.partidaId, x.cantidad, x.valor]
  );
}

// Suma lo devuelto a la partida. Devuelve false si ya no alcanza (otro cambio se coló).
export async function sumarDevuelto(db, empresaId, partidaId, cantidad, valor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE venta_partidas
     SET cantidad_devuelta = cantidad_devuelta + $3, valor_devuelto = valor_devuelto + $4
     WHERE empresa_id = $1 AND id = $2 AND cantidad_devuelta + $3 <= cantidad AND valor_devuelto + $4 <= total`,
    [empresaId, partidaId, cantidad, valor]
  );
  return r.rowCount > 0;
}

// Lo devuelto en una operación, para el comprobante
export async function lineasDeAjuste(db, empresaId, ajusteId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.nombre, vp.unidad, d.cantidad, d.valor
     FROM venta_devoluciones d
     JOIN venta_partidas vp ON vp.id = d.partida_id AND vp.empresa_id = d.empresa_id
     WHERE d.empresa_id = $1 AND d.ajuste_id = $2 ORDER BY vp.orden`,
    [empresaId, ajusteId]
  );
  return r.rows;
}