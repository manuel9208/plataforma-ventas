import { exigirEmpresa } from '../utils/tenant.js';

const n = (v) => Number(v ?? 0);

// Todo lo que entró y salió del turno: el dinero cuenta en el turno que lo recibió
export async function sumarTurno(db, empresaId, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT p.cobros_efectivo, p.cobros_tarjeta, p.cobros_transferencia,
            rb.reembolsos_efectivo, rb.reembolsos_tarjeta, rb.reembolsos_transferencia,
            m.gastos, m.retiros
     FROM (SELECT COALESCE(sum(monto) FILTER (WHERE forma = 'efectivo'), 0) AS cobros_efectivo,
                  COALESCE(sum(monto) FILTER (WHERE forma = 'tarjeta'), 0) AS cobros_tarjeta,
                  COALESCE(sum(monto) FILTER (WHERE forma = 'transferencia'), 0) AS cobros_transferencia
           FROM venta_pagos WHERE empresa_id = $1 AND turno_id = $2) p,
          (SELECT COALESCE(sum(monto) FILTER (WHERE forma = 'efectivo'), 0) AS reembolsos_efectivo,
                  COALESCE(sum(monto) FILTER (WHERE forma = 'tarjeta'), 0) AS reembolsos_tarjeta,
                  COALESCE(sum(monto) FILTER (WHERE forma = 'transferencia'), 0) AS reembolsos_transferencia
           FROM venta_reembolsos WHERE empresa_id = $1 AND turno_id = $2) rb,
          (SELECT COALESCE(sum(monto) FILTER (WHERE tipo = 'gasto'), 0) AS gastos,
                  COALESCE(sum(monto) FILTER (WHERE tipo = 'retiro'), 0) AS retiros
           FROM caja_movimientos WHERE empresa_id = $1 AND turno_id = $2 AND anulado_en IS NULL) m`,
    [empresaId, turnoId]
  );
  const f = r.rows[0];
  return {
    cobrosEfectivo: n(f.cobros_efectivo),
    cobrosTarjeta: n(f.cobros_tarjeta),
    cobrosTransferencia: n(f.cobros_transferencia),
    reembolsosEfectivo: n(f.reembolsos_efectivo),
    reembolsosTarjeta: n(f.reembolsos_tarjeta),
    reembolsosTransferencia: n(f.reembolsos_transferencia),
    gastos: n(f.gastos),
    retiros: n(f.retiros),
  };
}

// Foto fija del corte: un cambio posterior no altera cortes viejos
export async function insertarCorte(db, empresaId, x) {
  exigirEmpresa(empresaId);
  const k = x.calculo;
  await db.query(
    `INSERT INTO turno_cortes
       (turno_id, empresa_id, sucursal_id, caja_id, sin_conteo, fondo_inicial,
        cobros_efectivo, cobros_tarjeta, cobros_transferencia,
        reembolsos_efectivo, reembolsos_tarjeta, reembolsos_transferencia,
        gastos, retiros, esperado, contado, diferencia, dejado, entregado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      x.turnoId, empresaId, x.sucursalId, x.cajaId, x.sinConteo, k.fondo,
      k.cobrosEfectivo, k.cobrosTarjeta, k.cobrosTransferencia,
      k.reembolsosEfectivo, k.reembolsosTarjeta, k.reembolsosTransferencia,
      k.gastos, k.retiros, k.esperado,
      x.conteo?.contado ?? null, x.evaluacion?.diferencia ?? null, x.conteo?.dejado ?? null, x.conteo?.entregado ?? null,
    ]
  );
}

// Cuánto efectivo de ventas puede juntar la caja antes de avisar que se retire (la sucursal manda sobre la empresa)
export async function limiteRetiro(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT COALESCE(sc.retiro_efectivo_limite, ec.retiro_efectivo_limite, 1000) AS valor
     FROM empresas e
     LEFT JOIN empresa_config ec ON ec.empresa_id = e.id
     LEFT JOIN sucursal_config sc ON sc.empresa_id = e.id AND sc.sucursal_id = $2
     WHERE e.id = $1`,
    [empresaId, sucursalId]
  );
  return Number(r.rows[0]?.valor ?? 1000);
}