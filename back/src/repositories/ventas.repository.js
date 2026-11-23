import { exigirEmpresa } from '../utils/tenant.js';

// ---------- Folio ----------
// Prefijo del folio: se asigna en la primera venta (3 primeras letras de la sucursal) y se conserva
export async function obtenerOAsignarPrefijo(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO sucursal_config (empresa_id, sucursal_id) VALUES ($1, $2) ON CONFLICT (sucursal_id) DO NOTHING`,
    [empresaId, sucursalId]
  );
  const actual = await db.query(
    `SELECT prefijo_folio FROM sucursal_config WHERE empresa_id = $1 AND sucursal_id = $2 FOR UPDATE`,
    [empresaId, sucursalId]
  );
  if (actual.rows[0]?.prefijo_folio) return actual.rows[0].prefijo_folio;

  const s = await db.query(`SELECT nombre FROM sucursales WHERE empresa_id = $1 AND id = $2`, [empresaId, sucursalId]);
  const letras = (s.rows[0]?.nombre ?? 'SUC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const base = (letras + 'SUC').slice(0, 3);

  for (let n = 0; n < 100; n++) {
    const candidato = n === 0 ? base : `${base}${n + 1}`;
    const r = await db.query(
      `UPDATE sucursal_config SET prefijo_folio = $3, actualizado_en = now()
       WHERE empresa_id = $1 AND sucursal_id = $2 AND prefijo_folio IS NULL
         AND NOT EXISTS (SELECT 1 FROM sucursal_config o WHERE o.empresa_id = $1 AND o.prefijo_folio = $3)
       RETURNING prefijo_folio`,
      [empresaId, sucursalId, candidato]
    );
    if (r.rows[0]) return r.rows[0].prefijo_folio;
  }
  throw new Error('No se pudo asignar el prefijo del folio');
}

// Siguiente número, atómico y sin huecos (si la venta falla se deshace con la transacción)
export async function siguienteFolio(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO folios_sucursal (empresa_id, sucursal_id, ultimo_numero) VALUES ($1, $2, 1)
     ON CONFLICT (sucursal_id) DO UPDATE SET ultimo_numero = folios_sucursal.ultimo_numero + 1
     WHERE folios_sucursal.empresa_id = EXCLUDED.empresa_id
     RETURNING ultimo_numero`,
    [empresaId, sucursalId]
  );
  return r.rows[0].ultimo_numero;
}

// ---------- Turno ----------
// Bloquea el turno mientras dura la venta (evita cerrarlo a la mitad de un cobro)
export async function bloquearTurno(db, empresaId, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT t.id, t.sucursal_id, t.caja_id, t.usuario_id, t.cerrado_en,
            ((now() AT TIME ZONE COALESCE(s.zona_horaria, e.zona_horaria))::date > t.fecha_operativa) AS vencido
     FROM turnos t
     JOIN sucursales s ON s.id = t.sucursal_id AND s.empresa_id = t.empresa_id
     JOIN empresas e ON e.id = t.empresa_id
     WHERE t.empresa_id = $1 AND t.id = $2
     FOR UPDATE OF t`,
    [empresaId, turnoId]
  );
  return r.rows[0] || null;
}

// ---------- Datos para el cálculo ----------
// Precio efectivo (sucursal o general) y mayoreo, tomados del servidor
export async function cargarPresentaciones(db, empresaId, sucursalId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT pp.id AS presentacion_id, pp.nombre AS presentacion_nombre, pp.unidad, pp.factor, pp.se_vende, pp.activo AS presentacion_activa,
            COALESCE(ps.precio, pp.precio) AS precio, (ps.precio IS NOT NULL) AS precio_de_sucursal,
            p.id AS producto_id, p.departamento_id, p.sku, p.nombre AS producto_nombre, p.unidad_base, p.activo AS producto_activo,
            t.porcentaje AS tasa,
            EXISTS (SELECT 1 FROM producto_sucursal x
                    WHERE x.empresa_id = p.empresa_id AND x.producto_id = p.id AND x.sucursal_id = $2 AND x.activo) AS en_sucursal,
            (SELECT COALESCE(json_agg(json_build_object('cantidadMinima', v.cantidad_minima, 'precio', v.precio)
                                      ORDER BY v.cantidad_minima), '[]'::json)
               FROM presentacion_precios_volumen v
               WHERE v.empresa_id = pp.empresa_id AND v.presentacion_id = pp.id) AS mayoreo
     FROM producto_presentaciones pp
     JOIN productos p ON p.id = pp.producto_id AND p.empresa_id = pp.empresa_id
     JOIN tasas_iva t ON t.id = p.tasa_iva_id AND t.empresa_id = p.empresa_id
     LEFT JOIN presentacion_precio_sucursal ps
       ON ps.presentacion_id = pp.id AND ps.empresa_id = pp.empresa_id AND ps.sucursal_id = $2
     WHERE pp.empresa_id = $1 AND pp.id = ANY($3::bigint[])`,
    [empresaId, sucursalId, ids]
  );
  return r.rows;
}

export async function preciosIncluyenIva(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT precios_incluyen_iva FROM empresa_config WHERE empresa_id = $1`, [empresaId]);
  return r.rows[0]?.precios_incluyen_iva ?? true;
}

// ---------- Cliente ----------
export async function buscarClientePorTelefono(db, empresaId, telefono) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, activo FROM clientes WHERE empresa_id = $1 AND telefono = $2`, [empresaId, telefono]);
  return r.rows[0] || null;
}

export async function clienteActivo(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id FROM clientes WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, id]);
  return r.rowCount > 0;
}

// ---------- Venta ----------
export async function buscarVenta(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT v.id, v.folio, v.sucursal_id, v.turno_id, v.usuario_id, v.cliente_id, v.origen, v.precios_incluyen_iva,
            v.subtotal, v.iva, v.total, v.creado_en,
            s.nombre AS sucursal_nombre, c.nombre AS caja_nombre, u.nombre AS usuario_nombre, r.nivel_jerarquico AS usuario_nivel,
            COALESCE(s.zona_horaria, e.zona_horaria) AS zona,
            cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
     FROM ventas v
     JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
     JOIN empresas e ON e.id = v.empresa_id
     JOIN cajas c ON c.id = v.caja_id AND c.empresa_id = v.empresa_id
     JOIN usuarios u ON u.id = v.usuario_id AND u.empresa_id = v.empresa_id
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
     LEFT JOIN clientes cl ON cl.id = v.cliente_id AND cl.empresa_id = v.empresa_id
     WHERE v.empresa_id = $1 AND v.id = $2`,
    [empresaId, id]
  );
  return r.rows[0] || null;
}

export async function listarPartidas(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT orden, tipo, nombre, sku, unidad, cantidad, precio_lista, precio_aplicado, origen_precio, tasa_iva, base, iva, total, entregado_en,
            promocion_nombre, descuento, puntos_canjeados, descuento_puntos
     FROM venta_partidas WHERE empresa_id = $1 AND venta_id = $2 ORDER BY orden`,
    [empresaId, ventaId]
  );
  return r.rows;
}

export async function listarPagos(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT forma, monto, recibido, cambio, referencia, creado_en
     FROM venta_pagos WHERE empresa_id = $1 AND venta_id = $2 ORDER BY creado_en, id`,
    [empresaId, ventaId]
  );
  return r.rows;
}

// Devuelve false si el id ya existía (reintento): no se duplica nada
export async function insertarVenta(db, empresaId, v) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO ventas
       (id, empresa_id, sucursal_id, folio, folio_numero, caja_id, turno_id, usuario_id, cliente_id,
        origen, precios_incluyen_iva, subtotal, iva, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'mostrador', $10, $11, $12, $13)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      v.id, empresaId, v.sucursalId, v.folio, v.folioNumero, v.cajaId, v.turnoId, v.usuarioId, v.clienteId,
      v.incluyeIva, v.subtotal, v.iva, v.total,
    ]
  );
  return r.rowCount > 0;
}

export async function insertarPartidas(db, empresaId, ventaId, usuarioId, partidas) {
  exigirEmpresa(empresaId);
  for (const [i, p] of partidas.entries()) {
    await db.query(
      `INSERT INTO venta_partidas
         (empresa_id, venta_id, orden, tipo, producto_id, presentacion_id, nombre, sku, unidad, factor,
          cantidad, cantidad_base, precio_lista, precio_aplicado, origen_precio, tasa_iva, base, iva, total,
          entregado_en, entregado_por, promocion_id, promocion_nombre, descuento, descuento_origen,
          descuento_motivo, descuento_autorizado_por, puntos_canjeados, descuento_puntos)
       VALUES ($1, $2, $3, 'producto', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now(), $19,
               $20, $21, $22, $23, $24, $25, $26, $27)`,
      [
        empresaId, ventaId, i + 1, p.productoId, p.presentacionId, p.nombre, p.sku, p.unidad, p.factor,
        p.cantidad, p.cantidadBase, p.precioLista, p.precioAplicado, p.origenPrecio, p.tasa, p.base, p.iva, p.total,
        usuarioId,
        p.promocionId ?? null, p.promocionNombre ?? null, p.descuento ?? 0, p.descuentoOrigen ?? null,
        p.descuentoMotivo ?? null, p.descuentoAutorizadoPor ?? null,
        p.puntosCanjeados ?? 0, p.descuentoPuntos ?? 0,
      ]
    );
  }
}

export async function insertarPagos(db, empresaId, v, pagos) {
  exigirEmpresa(empresaId);
  for (const p of pagos) {
    await db.query(
      `INSERT INTO venta_pagos
         (empresa_id, venta_id, turno_id, caja_id, usuario_id, forma, monto, recibido, cambio, referencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [empresaId, v.id, v.turnoId, v.cajaId, v.usuarioId, p.forma, p.monto, p.recibido, p.cambio, p.referencia]
    );
  }
}