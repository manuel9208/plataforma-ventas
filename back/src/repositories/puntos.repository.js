import { exigirEmpresa } from '../utils/tenant.js';

const n = (v) => (v === null || v === undefined ? null : Number(v));

// La sucursal manda sobre la empresa; con sucursalId null solo cuenta la empresa
export async function cargarConfig(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(sc.puntos_ganar_productos, ec.puntos_ganar_productos) AS ganar_productos,
            COALESCE(sc.puntos_monto_productos, ec.puntos_monto_productos) AS monto_productos,
            COALESCE(sc.puntos_ganados_productos, ec.puntos_ganados_productos) AS ganados_productos,
            COALESCE(sc.puntos_ganar_servicios, ec.puntos_ganar_servicios) AS ganar_servicios,
            COALESCE(sc.puntos_monto_servicios, ec.puntos_monto_servicios) AS monto_servicios,
            COALESCE(sc.puntos_ganados_servicios, ec.puntos_ganados_servicios) AS ganados_servicios,
            COALESCE(sc.puntos_valor, ec.puntos_valor) AS valor,
            COALESCE(sc.puntos_promo_da, ec.puntos_promo_da) AS promo_da,
            COALESCE(sc.puntos_caducidad, ec.puntos_caducidad) AS caducidad,
            COALESCE(sc.puntos_caducidad_meses, ec.puntos_caducidad_meses) AS caducidad_meses,
            COALESCE(sc.puntos_caducidad_fecha, ec.puntos_caducidad_fecha) AS caducidad_fecha,
            COALESCE(sc.puntos_exigir_aviso, ec.puntos_exigir_aviso) AS exigir_aviso,
            COALESCE(sc.puntos_canjear_productos, ec.puntos_canjear_productos) AS canjear_productos,
            COALESCE(sc.puntos_canjear_servicios, ec.puntos_canjear_servicios) AS canjear_servicios,
            COALESCE(sc.puntos_canje_en_promo, ec.puntos_canje_en_promo) AS canje_en_promo,
            COALESCE(sc.puntos_tope_canje, ec.puntos_tope_canje) AS tope_canje,
            COALESCE(sc.puntos_minimo_canje, ec.puntos_minimo_canje) AS minimo_canje
     FROM empresa_config ec
     LEFT JOIN sucursal_config sc ON sc.empresa_id = ec.empresa_id AND sc.sucursal_id = $2::bigint
     WHERE ec.empresa_id = $1`,
    [empresaId, sucursalId ?? null]
  );
  const f = r.rows[0];
  if (!f) return { ganarProductos: false, ganarServicios: false, valor: 0, promoDa: true, caducidad: 'nunca', exigirAviso: false };
  return {
    ganarProductos: f.ganar_productos,
    montoProductos: n(f.monto_productos),
    ganadosProductos: n(f.ganados_productos),
    ganarServicios: f.ganar_servicios,
    montoServicios: n(f.monto_servicios),
    ganadosServicios: n(f.ganados_servicios),
    valor: n(f.valor),
    promoDa: f.promo_da,
    caducidad: f.caducidad,
    caducidadMeses: n(f.caducidad_meses),
    caducidadFecha: f.caducidad_fecha,
    exigirAviso: f.exigir_aviso,
    canjearProductos: f.canjear_productos,
    canjearServicios: f.canjear_servicios,
    canjeEnPromo: f.canje_en_promo,
    topeCanje: n(f.tope_canje),
    minimoCanje: n(f.minimo_canje),
  };
}

// "Hoy" en la zona de la sucursal (o de la empresa si no hay sucursal), como texto AAAA-MM-DD
export async function hoy(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT to_char((now() AT TIME ZONE COALESCE(s.zona_horaria, e.zona_horaria))::date, 'YYYY-MM-DD') AS hoy
     FROM empresas e
     LEFT JOIN sucursales s ON s.empresa_id = e.id AND s.id = $2::bigint
     WHERE e.id = $1`,
    [empresaId, sucursalId ?? null]
  );
  return r.rows[0].hoy;
}

export async function cargarCliente(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, activo, correo, cumple_mes, cumple_dia, (pin_hash IS NOT NULL) AS tiene_pin,
            (aviso_privacidad_en IS NOT NULL) AS aviso
     FROM clientes WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id]
  );
  return r.rows[0] || null;
}

// Evita que dos ajustes a la vez dejen al cliente con puntos negativos
export async function bloquearCliente(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id FROM clientes WHERE empresa_id = $1 AND id = $2 FOR UPDATE`, [empresaId, id]);
  return r.rowCount > 0;
}

export async function clienteDeVenta(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT cliente_id FROM ventas WHERE empresa_id = $1 AND id = $2`, [empresaId, ventaId]);
  return r.rows[0] ? { clienteId: r.rows[0].cliente_id } : null;
}

// Servicios que se acaban de entregar: total, descuento, cargo de financiamiento y sus extras
export async function partidasEntregadas(db, empresaId, partidaIds) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.id, vp.total, vp.descuento, ps.cargo_financiamiento AS cargo,
            COALESCE((SELECT sum(x.total) FROM partida_extra pe
                      JOIN venta_partidas x ON x.id = pe.partida_id AND x.empresa_id = pe.empresa_id
                      WHERE pe.empresa_id = vp.empresa_id AND pe.padre_partida_id = vp.id), 0) AS extras
     FROM venta_partidas vp
     JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.id = ANY($2::uuid[])`,
    [empresaId, partidaIds]
  );
  return r.rows.map((f) => ({ total: Number(f.total), descuento: Number(f.descuento), cargo: Number(f.cargo), extras: Number(f.extras) }));
}

// Todo el libro del cliente en orden cronológico. Un cliente tiene pocos movimientos: se lee completo para calcular el saldo.
export async function movimientosParaSaldo(db, empresaId, clienteId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT m.puntos, to_char(m.vence_en, 'YYYY-MM-DD') AS vence_en,
            to_char((m.creado_en AT TIME ZONE COALESCE(s.zona_horaria, e.zona_horaria))::date, 'YYYY-MM-DD') AS fecha
     FROM puntos_movimientos m
     JOIN empresas e ON e.id = m.empresa_id
     LEFT JOIN sucursales s ON s.id = m.sucursal_id AND s.empresa_id = m.empresa_id
     WHERE m.empresa_id = $1 AND m.cliente_id = $2
     ORDER BY m.creado_en, m.id`,
    [empresaId, clienteId]
  );
  return r.rows.map((f) => ({ puntos: Number(f.puntos), venceEn: f.vence_en, fecha: f.fecha }));
}

export async function ultimosMovimientos(db, empresaId, clienteId, limite) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT m.id, m.tipo, m.origen, m.puntos, m.motivo, to_char(m.vence_en, 'YYYY-MM-DD') AS vence_en, m.creado_en, v.folio,
            to_char((m.creado_en AT TIME ZONE COALESCE(s.zona_horaria, e.zona_horaria))::date, 'YYYY-MM-DD') AS fecha
     FROM puntos_movimientos m
     JOIN empresas e ON e.id = m.empresa_id
     LEFT JOIN sucursales s ON s.id = m.sucursal_id AND s.empresa_id = m.empresa_id
     LEFT JOIN ventas v ON v.id = m.venta_id AND v.empresa_id = m.empresa_id
     WHERE m.empresa_id = $1 AND m.cliente_id = $2
     ORDER BY m.creado_en DESC, m.id LIMIT $3`,
    [empresaId, clienteId, limite]
  );
  return r.rows;
}

// Devuelve false si la clave ya existía (reintento): no se duplica nada
export async function insertarMovimiento(db, empresaId, m) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO puntos_movimientos
       (empresa_id, cliente_id, venta_id, sucursal_id, tipo, origen, puntos, base, vence_en, motivo, clave, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12)
     ON CONFLICT (empresa_id, clave) DO NOTHING RETURNING id`,
    [empresaId, m.clienteId, m.ventaId ?? null, m.sucursalId ?? null, m.tipo, m.origen, m.puntos, m.base ?? 0, m.venceEn ?? null, m.motivo ?? null, m.clave, m.usuarioId ?? null]
  );
  return r.rowCount > 0;
}

// Lo que ya dio y lo que ya se quitó de una venta, por origen (venta = productos, entrega = servicios)
export async function totalesVenta(db, empresaId, ventaId, origen) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(sum(puntos) FILTER (WHERE tipo = 'ganado'), 0) AS ganados,
            COALESCE(sum(base) FILTER (WHERE tipo = 'ganado'), 0) AS base_ganada,
            COALESCE(-sum(puntos) FILTER (WHERE tipo = 'reversa'), 0) AS revertidos,
            COALESCE(sum(base) FILTER (WHERE tipo = 'reversa'), 0) AS base_devuelta,
            min(cliente_id::text) AS cliente_id
     FROM puntos_movimientos WHERE empresa_id = $1 AND venta_id = $2 AND origen = $3`,
    [empresaId, ventaId, origen]
  );
  const f = r.rows[0];
  return {
    ganados: Number(f.ganados),
    baseGanada: Number(f.base_ganada),
    revertidos: Number(f.revertidos),
    baseDevuelta: Number(f.base_devuelta),
    clienteId: f.cliente_id,
  };
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

// ¿Esta venta ya usó puntos? (una compra pagada con puntos no gana puntos)
export async function ventaTieneCanje(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT 1 FROM puntos_movimientos WHERE empresa_id = $1 AND venta_id = $2 AND tipo = 'canje' LIMIT 1`, [empresaId, ventaId]);
  return r.rowCount > 0;
}

// Renglones de una venta que se pagaron en parte con puntos
export async function partidasConCanje(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  if (!ids.length) return [];
  const r = await db.query(
    `SELECT id, puntos_canjeados, total, valor_devuelto
     FROM venta_partidas WHERE empresa_id = $1 AND id = ANY($2::uuid[]) AND puntos_canjeados > 0`,
    [empresaId, ids]
  );
  return r.rows.map((f) => ({ id: f.id, puntos: Number(f.puntos_canjeados), total: Number(f.total), valorDevuelto: Number(f.valor_devuelto) }));
}

// Puntos que se usaron en una venta y cuántos ya se devolvieron (los devueltos van como ajuste de origen canje)
export async function totalesCanje(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(-sum(puntos) FILTER (WHERE tipo = 'canje'), 0) AS usados,
            COALESCE(sum(puntos) FILTER (WHERE tipo = 'ajuste' AND origen = 'canje'), 0) AS devueltos,
            min(cliente_id::text) AS cliente_id
     FROM puntos_movimientos WHERE empresa_id = $1 AND venta_id = $2`,
    [empresaId, ventaId]
  );
  const f = r.rows[0];
  return { usados: Number(f.usados), devueltos: Number(f.devueltos), clienteId: f.cliente_id };
}