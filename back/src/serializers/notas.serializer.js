import { estadoDeNota, resumenNota } from '@plataforma/calculos';
import { nombreParaTicket } from '../utils/atendio.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

// Estado de la nota a partir de los contadores de la lista
export function estadoDesdeContadores(f) {
  const n = (x) => Number(x);
  if (n(f.cancelados) === n(f.articulos)) return 'cancelada';
  const estados = [
    ...Array(n(f.en_espera)).fill('recibido'),
    ...Array(n(f.listos)).fill('listo'),
    ...Array(n(f.entregados)).fill('entregado'),
    ...Array(n(f.cancelados)).fill('cancelado'),
  ];
  return estadoDeNota(estados);
}

export function notaLista(f) {
  const r = resumenNota({
    total: Number(f.total),
    cancelado: Number(f.cancelado),
    ajustado: Number(f.ajustado),
    retenido: Number(f.retenido),
    reembolsado: Number(f.reembolsado),
    cobrado: Number(f.pagado),
  });
  return {
    id: f.id,
    folio: f.folio,
    sucursal: f.sucursal,
    cliente: f.cliente_nombre ? { nombre: f.cliente_nombre, telefono: f.cliente_telefono } : null,
    total: r.total,
    totalOriginal: r.totalOriginal,
    pagado: r.pagado,
    saldo: r.saldo,
    articulos: Number(f.articulos),
    enEspera: Number(f.en_espera),
    listos: Number(f.listos),
    entregados: Number(f.entregados),
    estado: estadoDesdeContadores(f),
    fechaPrometida: f.prometida,
    creadaEn: f.creado_en,
    zonaHoraria: f.zona,
  };
}

export function notaDetalle(v, productos, articulos, pagos, pies, ajustes = { vigentes: { productos: 0, servicios: 0, hechos: 0 }, reembolsos: [] }) {
  const cobrado = Number(pagos.reduce((s, p) => s + Number(p.monto), 0).toFixed(2));
  const resumen = resumenNota({
    total: Number(v.total),
    cancelado: Number(v.cancelado),
    ajustado: Number(v.ajustado),
    retenido: Number(v.retenido),
    reembolsado: Number(v.reembolsado),
    cobrado,
  });
  const servicios = articulos
    .filter((a) => a.tipo === 'servicio')
    .map((a) => ({
      partidaId: a.id,
      articuloId: a.venta_articulo_id ?? null,
      comentario: a.comentario ?? null,
      nombre: a.nombre,
      tipoArticulo: a.tipo_articulo_nombre,
      estado: a.estado_trabajo,
      fechaPrometida: a.fecha_prometida,
      fechaPrometidaOriginal: a.fecha_prometida_original,
      listoEn: a.listo_en,
      total: Number(a.total),
      cargoFinanciamiento: Number(a.cargo_financiamiento ?? 0),
      articulo: sinVacios({
        marca: a.marca,
        talla: a.talla,
        color: a.color,
        modelo: a.modelo,
        textura: a.textura,
        descripcion: a.descripcion,
      }),
      extras: articulos.filter((x) => x.tipo === 'extra' && x.padre_partida_id === a.id).map((x) => ({ nombre: x.nombre, total: Number(x.total) })),
    }));

  return {
    id: v.id,
    sucursalId: v.sucursal_id,
    folio: v.folio,
    empresa: v.empresa_nombre,
    sucursal: v.sucursal_nombre,
    direccion: v.sucursal_direccion,
    caja: v.caja_nombre,
    cajero: nombreParaTicket(v.cajero_nombre, v.cajero_nivel),
    cliente: v.cliente_id ? { id: v.cliente_id, nombre: v.cliente_nombre, telefono: v.cliente_telefono } : null,
    // total = lo que vale la nota ahora; pagado = lo cobrado menos lo devuelto
    total: resumen.total,
    totalOriginal: resumen.totalOriginal,
    // Con cancelaciones o reembolsos el desglose de IVA original ya no cuadra
    subtotal: resumen.hayAjustes ? null : num(v.subtotal),
    iva: resumen.hayAjustes ? null : num(v.iva),
    preciosIncluyenIva: v.precios_incluyen_iva,
    pagado: resumen.pagado,
    saldo: resumen.saldo,
    estadoPago: resumen.estadoPago,
    cancelado: Number(v.cancelado),
    ajustado: Number(v.ajustado),
    retenido: Number(v.retenido),
    reembolsado: Number(v.reembolsado),
    // Los números que la pantalla necesita para mostrar cuánto se puede devolver (el servidor vuelve a calcular)
    valores: {
      total: Number(v.total),
      cancelado: Number(v.cancelado),
      ajustado: Number(v.ajustado),
      retenido: Number(v.retenido),
      reembolsado: Number(v.reembolsado),
      cobrado,
      productosVigentes: ajustes.vigentes.productos,
      serviciosVigentes: ajustes.vigentes.servicios,
      serviciosHechos: ajustes.vigentes.hechos,
    },
    reembolsos: ajustes.reembolsos.map((r) => ({
      tipo: r.tipo,
      forma: r.forma,
      monto: Number(r.monto),
      referencia: r.referencia,
      motivo: r.motivo,
      creadoEn: r.creado_en,
      quien: r.quien,
      caja: r.caja,
    })),
    estado: estadoDeNota(servicios.map((s) => s.estado)),
    tienePin: v.tiene_pin,
    financiada: v.financiada ?? false,
    creadaEn: v.creado_en,
    zonaHoraria: v.zona,
    servicios,
    productos: productos.map((p) => ({
      partidaId: p.id,
      devuelto: p.devuelto,
      nombre: p.nombre,
      cantidad: Number(p.cantidad),
      unidad: p.unidad,
      precio: Number(p.precio_aplicado),
      total: Number(p.total),
    })),
    pagos: pagos.map((p) => ({
      forma: p.forma,
      monto: Number(p.monto),
      referencia: p.referencia,
      creadoEn: p.creado_en,
      cobro: p.cobro,
      caja: p.caja,
    })),
    pieRecepcion: pies.recepcion,
    pieEntrega: pies.entrega,
  };
}

export function reciboCobro(venta, cobro, pagos) {
  const aplicado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const cambio = pagos.reduce((s, p) => s + Number(p.cambio), 0);
  return {
    folio: venta.folio,
    cliente: venta.cliente,
    cobradoEn: cobro.creado_en,
    zonaHoraria: venta.zonaHoraria,
    monto: Number(aplicado.toFixed(2)),
    cambio: Number(cambio.toFixed(2)),
    pagos: pagos.map((p) => ({ forma: p.forma, monto: Number(p.monto), referencia: p.referencia })),
    total: venta.total,
    pagado: venta.pagado,
    saldo: venta.saldo,
    cobro: nombreParaTicket(pagos[0]?.cobro, pagos[0]?.cobro_nivel),
    caja: pagos[0]?.caja ?? null,
  };
}