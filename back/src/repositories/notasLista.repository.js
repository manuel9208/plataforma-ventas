import { PESTANAS_DE_GESTION } from '@plataforma/calculos';
import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

// MISMA fórmula que shared/calculos/saldo.js (resumenNota), escrita en SQL para filtrar y contar.
export const SALDO_SQL = `GREATEST(GREATEST(v.total - v.cancelado - v.ajustado, 0) + v.retenido - GREATEST(pg.pagado - v.reembolsado, 0), 0)`;
// Las otras dos cifras de resumenNota (valor vigente y pagado neto), en SQL
export const VALOR_SQL = `(GREATEST(v.total - v.cancelado - v.ajustado, 0) + v.retenido)`;
export const PAGADO_SQL = `GREATEST(pg.pagado - v.reembolsado, 0)`;

// Notas de servicio de las sucursales del usuario, con su saldo y estado ya calculados en SQL.
// $1 empresa, $2 sucursales del actor.
const BASE = `
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
  LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.monto), 0) AS pagado FROM venta_pagos p WHERE p.empresa_id = v.empresa_id AND p.venta_id = v.id
  ) pg ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS articulos,
           count(*) FILTER (WHERE ps.estado_trabajo IN ('recibido', 'en_proceso')) AS en_espera,
           count(*) FILTER (WHERE ps.estado_trabajo = 'listo') AS listos,
           count(*) FILTER (WHERE ps.estado_trabajo = 'entregado') AS entregados,
           count(*) FILTER (WHERE ps.estado_trabajo = 'cancelado') AS cancelados,
           min(ps.fecha_prometida) FILTER (WHERE ps.estado_trabajo IN ('recibido', 'en_proceso', 'listo')) AS prometida
    FROM venta_partidas vp
    JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
    WHERE vp.empresa_id = v.empresa_id AND vp.venta_id = v.id AND vp.tipo = 'servicio'
  ) sv ON TRUE
  WHERE v.empresa_id = $1 AND v.sucursal_id = ANY($2::bigint[]) AND v.tiene_servicios`;

// Condición de cada pestaña (todas sobre lo ya calculado arriba)
const PESTANAS = {
  cobrar: `AND ${SALDO_SQL} > 0 AND sv.cancelados < sv.articulos`,
  espera: `AND sv.en_espera > 0`,
  entregar: `AND sv.listos > 0`,
  entregadas: `AND (sv.en_espera + sv.listos) = 0 AND sv.entregados > 0`,
  canceladas: `AND sv.cancelados = sv.articulos`,
};

export async function listar(db, empresaId, sucursales, { pestana, buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  if (!PESTANAS[pestana]) throw new Error('Pestaña desconocida');
  const params = [empresaId, sucursales];
  let filtro = PESTANAS[pestana];

  if (buscar) {
    params.push(escaparLike(buscar));
    const n = params.length;
    filtro += ` AND (v.folio ILIKE $${n} OR c.nombre ILIKE $${n} OR c.telefono LIKE $${n})`;
  }

  const total = await db.query(`SELECT count(*) AS n ${BASE} ${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT v.id, v.folio, v.total, v.cancelado, v.ajustado, v.retenido, v.reembolsado, v.creado_en,
            s.nombre AS sucursal, COALESCE(s.zona_horaria, (SELECT zona_horaria FROM empresas WHERE id = v.empresa_id)) AS zona,
            c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
            pg.pagado, ${SALDO_SQL} AS saldo,
            sv.articulos, sv.en_espera, sv.listos, sv.entregados, sv.cancelados, sv.prometida
     ${BASE} ${filtro}
     ORDER BY v.creado_en DESC, v.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

// Cuántas notas hay en cada pestaña (para los contadores)
export async function contar(db, empresaId, sucursales, verTodas) {
  exigirEmpresa(empresaId);
  const columnas = Object.entries(PESTANAS)
    .filter(([k]) => verTodas || !PESTANAS_DE_GESTION.includes(k))
    .map(([k, cond]) => `count(*) FILTER (WHERE TRUE ${cond}) AS ${k}`);
  const r = await db.query(`SELECT ${columnas.join(', ')} ${BASE}`, [empresaId, sucursales]);
  return r.rows[0];
}

// Una nota, solo si es de una sucursal del usuario
export async function obtener(db, empresaId, sucursales, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.sucursal_id, v.folio, v.total, v.subtotal, v.iva, v.precios_incluyen_iva, v.creado_en, v.tiene_servicios,
            v.cancelado, v.ajustado, v.retenido, v.reembolsado,
            v.financiada, (v.pin_entrega_hash IS NOT NULL) AS tiene_pin,
            s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion, s.telefono AS sucursal_telefono,
            COALESCE(s.zona_horaria, e.zona_horaria) AS zona, e.nombre AS empresa_nombre,
            cj.nombre AS caja_nombre, u.nombre AS cajero_nombre, ro.nivel_jerarquico AS cajero_nivel,
            c.id AS cliente_id, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     JOIN cajas cj ON cj.id = v.caja_id AND cj.empresa_id = v.empresa_id
     JOIN usuarios u ON u.id = v.usuario_id AND u.empresa_id = v.empresa_id
     JOIN roles ro ON ro.id = u.rol_id AND ro.empresa_id = u.empresa_id
     LEFT JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
     WHERE v.empresa_id = $1 AND v.id = $2 AND v.sucursal_id = ANY($3::bigint[])`,
    [empresaId, id, sucursales]
  );
  return r.rows[0] || null;
}

export async function listarPagosConQuien(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT p.forma, p.monto, p.recibido, p.cambio, p.referencia, p.creado_en,
            u.nombre AS cobro, ru.nivel_jerarquico AS cobro_nivel, cj.nombre AS caja, p.turno_id
     FROM venta_pagos p
     JOIN usuarios u ON u.id = p.usuario_id AND u.empresa_id = p.empresa_id
     JOIN roles ru ON ru.id = u.rol_id AND ru.empresa_id = u.empresa_id
     JOIN cajas cj ON cj.id = p.caja_id AND cj.empresa_id = p.empresa_id
     WHERE p.empresa_id = $1 AND p.venta_id = $2
     ORDER BY p.creado_en, p.id`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// Partidas de servicio (y extras) con su estado, para el detalle
export async function listarArticulos(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.id, vp.orden, vp.tipo, vp.nombre, vp.total,
            ps.estado_trabajo, ps.fecha_prometida, ps.fecha_prometida_original, ps.listo_en, ps.tipo_articulo_nombre,
            ps.venta_articulo_id, va.comentario, ps.cargo_financiamiento,
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
  return r.rows;
}

export async function listarProductos(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, orden, nombre, cantidad, unidad, precio_aplicado, total, (ajuste_id IS NOT NULL) AS devuelto
     FROM venta_partidas WHERE empresa_id = $1 AND venta_id = $2 AND tipo = 'producto' ORDER BY orden`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// ---------- Cobro de saldo ----------
// Bloquea la venta para que dos cobros a la vez no se pasen del saldo (trae los números del saldo)
export async function bloquearVenta(db, empresaId, ventaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.sucursal_id, v.total, v.tiene_servicios, v.cancelado, v.ajustado, v.retenido, v.reembolsado
     FROM ventas v WHERE v.empresa_id = $1 AND v.id = $2 AND v.sucursal_id = ANY($3::bigint[]) FOR UPDATE`,
    [empresaId, ventaId, sucursales]
  );
  return r.rows[0] || null;
}

export async function totalPagado(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT COALESCE(sum(monto), 0) AS pagado FROM venta_pagos WHERE empresa_id = $1 AND venta_id = $2`, [
    empresaId,
    ventaId,
  ]);
  return Number(r.rows[0].pagado);
}

export async function buscarCobro(db, empresaId, cobroId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, venta_id, usuario_id FROM venta_cobros WHERE empresa_id = $1 AND id = $2`, [empresaId, cobroId]);
  return r.rows[0] || null;
}

export async function insertarCobro(db, empresaId, c) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO venta_cobros (id, empresa_id, venta_id, usuario_id, turno_id, monto)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [c.id, empresaId, c.ventaId, c.usuarioId, c.turnoId, c.monto]
  );
  return r.rowCount > 0;
}

export async function insertarPagosDeCobro(db, empresaId, c, pagos) {
  exigirEmpresa(empresaId);
  for (const p of pagos) {
    await db.query(
      `INSERT INTO venta_pagos
         (empresa_id, venta_id, turno_id, caja_id, usuario_id, forma, monto, recibido, cambio, referencia, cobro_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [empresaId, c.ventaId, c.turnoId, c.cajaId, c.usuarioId, p.forma, p.monto, p.recibido, p.cambio, p.referencia, c.id]
    );
  }
}

export async function pagosDeCobro(db, empresaId, cobroId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT p.forma, p.monto, p.recibido, p.cambio, p.referencia, p.creado_en, u.nombre AS cobro, ru.nivel_jerarquico AS cobro_nivel, cj.nombre AS caja
     FROM venta_pagos p
     JOIN usuarios u ON u.id = p.usuario_id AND u.empresa_id = p.empresa_id
     JOIN roles ru ON ru.id = u.rol_id AND ru.empresa_id = u.empresa_id
     JOIN cajas cj ON cj.id = p.caja_id AND cj.empresa_id = p.empresa_id
     WHERE p.empresa_id = $1 AND p.cobro_id = $2 ORDER BY p.creado_en, p.id`,
    [empresaId, cobroId]
  );
  return r.rows;
}

// ---------- Estados del trabajo ----------
export async function cargarPartidasEstado(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ps.partida_id, ps.estado_trabajo
     FROM partida_servicio ps
     JOIN venta_partidas vp ON vp.id = ps.partida_id AND vp.empresa_id = ps.empresa_id
     WHERE ps.empresa_id = $1 AND vp.venta_id = $2 FOR UPDATE OF ps`,
    [empresaId, ventaId]
  );
  return r.rows;
}

export async function cambiarEstado(db, empresaId, partidaId, nuevo, usuarioId) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE partida_servicio
     SET estado_trabajo = $3,
         listo_en = CASE WHEN $3 = 'listo' THEN now() ELSE NULL END,
         listo_por = CASE WHEN $3 = 'listo' THEN $4::bigint ELSE NULL END,
         aviso_listo_enviado_en = CASE WHEN $3 = 'listo' THEN aviso_listo_enviado_en ELSE NULL END
     WHERE empresa_id = $1 AND partida_id = $2`,
    [empresaId, partidaId, nuevo, usuarioId]
  );
}

export async function registrarCambioEstado(db, empresaId, e) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO partida_estado_historial
       (empresa_id, partida_id, estado_anterior, estado_nuevo, usuario_id, motivo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [empresaId, e.partidaId, e.anterior, e.nuevo, e.usuarioId, e.motivo ?? null]
  );
}

// ---------- Corrección de datos (nada de dinero) ----------
export async function actualizarArticulo(db, empresaId, partidaId, datos) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE partida_articulos SET marca = $3, talla = $4, color = $5, modelo = $6, textura = $7, descripcion = $8
     WHERE empresa_id = $1 AND partida_id = $2`,
    [empresaId, partidaId, datos.marca, datos.talla, datos.color, datos.modelo, datos.textura, datos.descripcion]
  );
}

export async function actualizarFechaPrometida(db, empresaId, partidaId, fecha) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE partida_servicio SET fecha_prometida = $3::date WHERE empresa_id = $1 AND partida_id = $2`, [
    empresaId,
    partidaId,
    fecha,
  ]);
}

export async function cambiarCliente(db, empresaId, ventaId, clienteId) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE ventas SET cliente_id = $3 WHERE empresa_id = $1 AND id = $2`, [empresaId, ventaId, clienteId]);
}

export async function articulosDeVenta(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT vp.id AS partida_id, ps.estado_trabajo, ps.fecha_prometida,
            pa.marca, pa.talla, pa.color, pa.modelo, pa.textura, pa.descripcion
     FROM venta_partidas vp
     JOIN partida_servicio ps ON ps.partida_id = vp.id AND ps.empresa_id = vp.empresa_id
     JOIN partida_articulos pa ON pa.partida_id = vp.id AND pa.empresa_id = vp.empresa_id
     WHERE vp.empresa_id = $1 AND vp.venta_id = $2 AND vp.tipo = 'servicio'`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// ---------- Pie del ticket (la sucursal manda sobre la empresa) ----------
export async function cargarPies(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ec.pie_ticket_recepcion AS e_rec, ec.pie_ticket_entrega AS e_ent,
            sc.pie_ticket_recepcion AS s_rec, sc.pie_ticket_entrega AS s_ent
     FROM empresas e
     LEFT JOIN empresa_config ec ON ec.empresa_id = e.id
     LEFT JOIN sucursal_config sc ON sc.empresa_id = e.id AND sc.sucursal_id = $2
     WHERE e.id = $1`,
    [empresaId, sucursalId]
  );
  const f = r.rows[0] ?? {};
  return { recepcion: f.s_rec ?? f.e_rec ?? '', entrega: f.s_ent ?? f.e_ent ?? '' };
}