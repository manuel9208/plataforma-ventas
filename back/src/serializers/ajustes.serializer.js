// Comprobante de cancelación o reembolso. Nunca lleva PIN.
export function comprobante(detalle, { ajuste, partidas, reembolso }, repetido = false) {
  return {
    id: ajuste.id,
    repetido,
    tipo: ajuste.tipo,
    folio: detalle.folio,
    empresa: detalle.empresa,
    sucursal: detalle.sucursal,
    zonaHoraria: detalle.zonaHoraria,
    caja: ajuste.caja,
    hizo: ajuste.hizo,
    autorizo: ajuste.autorizo,
    motivo: ajuste.motivo,
    creadoEn: ajuste.creado_en,
    cliente: detalle.cliente ? { nombre: detalle.cliente.nombre, telefono: detalle.cliente.telefono } : null,
    cancelados: partidas.map((p) => ({ nombre: p.nombre, tipo: p.tipo, total: Number(p.total) })),
    valorCancelado: Number(ajuste.valor_cancelado),
    tope: Number(ajuste.tope),
    devuelto: Number(ajuste.devuelto),
    retenido: Number(ajuste.retenido),
    reembolso: reembolso ? { forma: reembolso.forma, monto: Number(reembolso.monto), referencia: reembolso.referencia } : null,
    nota: { total: detalle.total, pagado: detalle.pagado, saldo: detalle.saldo },
  };
}