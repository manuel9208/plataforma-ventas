import { aCentavos, aMonto, calcularEstadoPago } from '@plataforma/calculos';
import { nombreParaTicket } from '../utils/atendio.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

const NOTA_VACIA = { tieneServicios: false, tienePin: false, servicios: [] };

export function venta(v, partidas, pagos, nota = NOTA_VACIA) {
  const estadoPago = calcularEstadoPago(Number(v.total), pagos.map((p) => Number(p.monto)));

  const servicios = nota.servicios
    .filter((f) => f.tipo === 'servicio')
    .map((f) => ({
      partidaId: f.id,
      orden: f.orden,
      nombre: f.nombre,
      tipoArticulo: f.tipo_articulo_nombre,
      estado: f.estado_trabajo,
      porCotizar: Boolean(f.por_cotizar) && !f.cotizado_en,
      fechaPrometida: f.fecha_prometida,
      fechaPrometidaOriginal: f.fecha_prometida_original,
      porCotizar: f.por_cotizar === true,
      articuloId: f.venta_articulo_id ?? null,
      comentario: f.comentario ?? null,
      total: Number(f.total),
      cargoFinanciamiento: Number(f.cargo_financiamiento ?? 0),
      promocion: f.promocion_nombre ?? null,
      descuento: Number(f.descuento ?? 0),
      // Lo que está vacío no se manda, para que no salga en el ticket
      articulo: sinVacios({
        marca: f.marca,
        talla: f.talla,
        color: f.color,
        modelo: f.modelo,
        textura: f.textura,
        descripcion: f.descripcion,
      }),
      extras: nota.servicios
        .filter((x) => x.tipo === 'extra' && x.padre_partida_id === f.id)
        .map((x) => ({ nombre: x.nombre, total: Number(x.total) })),
    }));

  return {
    id: v.id,
    folio: v.folio,
    sucursal: v.sucursal_nombre,
    caja: v.caja_nombre,
    cajero: nombreParaTicket(v.usuario_nombre, v.usuario_nivel),
    cliente: v.cliente_nombre ? { nombre: v.cliente_nombre, telefono: v.cliente_telefono } : null,
    preciosIncluyenIva: v.precios_incluyen_iva,
    subtotal: num(v.subtotal),
    iva: num(v.iva),
    total: Number(v.total),
    estadoPago: estadoPago.estado,
    pagado: estadoPago.pagado,
    saldo: estadoPago.saldo,
    tieneServicios: nota.tieneServicios,
    tienePin: nota.tienePin,
    financiada: nota.financiada ?? false,
    // Lo que se pagó con puntos (ya viene descontado de los precios)
    canje:
      partidas.some((p) => Number(p.puntos_canjeados) > 0)
        ? {
            puntos: partidas.reduce((s, p) => s + Number(p.puntos_canjeados ?? 0), 0),
            descuento: aMonto(partidas.reduce((s, p) => s + Math.round(aCentavos(Number(p.descuento_puntos ?? 0))), 0)),
          }
        : null,
    servicios,
    creadaEn: v.creado_en,
    zonaHoraria: v.zona,
    partidas: partidas.map((p) => ({
      orden: p.orden,
      tipo: p.tipo,
      nombre: p.nombre,
      sku: p.sku,
      unidad: p.unidad,
      cantidad: Number(p.cantidad),
      precioLista: Number(p.precio_lista),
      precioAplicado: Number(p.precio_aplicado),
      origenPrecio: p.origen_precio,
      promocion: p.promocion_nombre ?? null,
      descuento: Number(p.descuento ?? 0),
      tasaIva: Number(p.tasa_iva),
      base: num(p.base),
      iva: num(p.iva),
      total: Number(p.total),
      entregadoEn: p.entregado_en,
    })),
    pagos: pagos.map((p) => ({
      forma: p.forma,
      monto: Number(p.monto),
      recibido: Number(p.recibido),
      cambio: Number(p.cambio),
      referencia: p.referencia,
    })),
  };
}