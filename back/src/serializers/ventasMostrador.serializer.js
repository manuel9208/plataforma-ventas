import { cantidadDisponible, permiteDecimales, resumenNota } from '@plataforma/calculos';

const num = (v) => (v === null || v === undefined ? null : Number(v));

// completa | parcial (se devolvió una parte) | devuelta (todo)
function estadoVenta(total, cancelado) {
  if (cancelado <= 0) return 'completa';
  return cancelado >= total ? 'devuelta' : 'parcial';
}

export function ventaLista(f) {
  const total = Number(f.total);
  const cancelado = Number(f.cancelado);
  return {
    id: f.id,
    folio: f.folio,
    sucursal: f.sucursal,
    caja: f.caja,
    cajero: f.cajero,
    cliente: f.cliente_nombre ? { nombre: f.cliente_nombre, telefono: f.cliente_telefono } : null,
    total,
    devuelto: cancelado,
    articulos: Number(f.articulos),
    estado: estadoVenta(total, cancelado),
    creadaEn: f.creado_en,
    zonaHoraria: f.zona,
  };
}

export function ventaDetalle(v, productos, pagos, reembolsos) {
  const cobrado = Number(pagos.reduce((s, p) => s + Number(p.monto), 0).toFixed(2));
  const total = Number(v.total);
  const cancelado = Number(v.cancelado);
  const resumen = resumenNota({ total, cancelado, ajustado: 0, retenido: 0, reembolsado: Number(v.reembolsado), cobrado });

  const lista = productos.map((p) => {
    const base = { cantidad: Number(p.cantidad), cantidadDevuelta: Number(p.cantidad_devuelta) };
    return {
      partidaId: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      decimales: permiteDecimales(p.unidad),
      ...base,
      disponible: cantidadDisponible(base),
      precio: Number(p.precio_aplicado),
      origenPrecio: p.origen_precio,
      total: Number(p.total),
      valorDevuelto: Number(p.valor_devuelto),
    };
  });

  return {
    id: v.id,
    sucursalId: v.sucursal_id,
    turnoId: v.turno_id,
    folio: v.folio,
    empresa: v.empresa_nombre,
    sucursal: v.sucursal_nombre,
    caja: v.caja_nombre,
    cajero: v.cajero_nombre,
    cliente: v.cliente_id ? { id: v.cliente_id, nombre: v.cliente_nombre, telefono: v.cliente_telefono } : null,
    total, // lo que costó la venta
    devuelto: cancelado,
    vale: resumen.total, // lo que vale ahora, ya sin lo devuelto
    pagado: resumen.pagado,
    saldo: resumen.saldo,
    // Con devoluciones el desglose de IVA original ya no cuadra
    subtotal: cancelado > 0 ? null : num(v.subtotal),
    iva: cancelado > 0 ? null : num(v.iva),
    preciosIncluyenIva: v.precios_incluyen_iva,
    estado: estadoVenta(total, cancelado),
    puedeDevolver: lista.some((p) => p.disponible > 0),
    creadaEn: v.creado_en,
    zonaHoraria: v.zona,
    productos: lista,
    pagos: pagos.map((p) => ({
      forma: p.forma,
      monto: Number(p.monto),
      referencia: p.referencia,
      creadoEn: p.creado_en,
      cobro: p.cobro,
      caja: p.caja,
    })),
    reembolsos: reembolsos.map((r) => ({
      tipo: r.tipo,
      forma: r.forma,
      monto: Number(r.monto),
      referencia: r.referencia,
      motivo: r.motivo,
      creadoEn: r.creado_en,
      quien: r.quien,
      caja: r.caja,
    })),
  };
}

// Comprobante de devolución. Mismo formato que el de cancelaciones, nunca lleva PIN.
export function comprobanteDevolucion(detalle, { ajuste, lineas, reembolso }, repetido = false) {
  return {
    id: ajuste.id,
    repetido,
    tipo: 'devolucion',
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
    cancelados: lineas.map((l) => ({ nombre: l.nombre, tipo: 'producto', unidad: l.unidad, cantidad: Number(l.cantidad), total: Number(l.valor) })),
    valorCancelado: Number(ajuste.valor_cancelado),
    tope: Number(ajuste.tope),
    devuelto: Number(ajuste.devuelto),
    retenido: 0,
    reembolso: reembolso ? { forma: reembolso.forma, monto: Number(reembolso.monto), referencia: reembolso.referencia } : null,
    nota: { total: detalle.vale, pagado: detalle.pagado, saldo: detalle.saldo },
  };
}