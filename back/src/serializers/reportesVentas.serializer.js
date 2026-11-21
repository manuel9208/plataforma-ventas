import { aCentavos, aMonto } from '@plataforma/calculos';
import { estadoDesdeContadores } from './notas.serializer.js';

const n = (v) => Number(v ?? 0);
const c = (v) => Math.round(aCentavos(n(v)));
const suma = (lista, clave) => aMonto(lista.reduce((s, x) => s + c(x[clave]), 0));

export function filaVenta(f, articulos = null) {
  const cancelada = n(f.total) > 0 && n(f.cancelado) >= n(f.total);
  const estado = cancelada ? 'cancelada' : f.tiene_servicios ? estadoDesdeContadores(f) : 'venta';
  return {
    id: f.id,
    folio: f.folio,
    sucursalId: n(f.sucursal_id),
    sucursal: f.sucursal,
    fecha: f.creado_en,
    zonaHoraria: f.zona,
    cliente: f.cliente_nombre ?? null,
    telefono: f.cliente_telefono ?? null,
    cajero: f.cajero,
    tipo: f.tiene_servicios ? 'Nota de servicio' : 'Venta de mostrador',
    estado,
    entrega: f.prometida ?? null,
    total: n(f.valor),
    abonado: n(f.abonado),
    pendiente: cancelada ? 0 : n(f.saldo),
    iva: f.iva === null ? null : n(f.iva),
    efectivo: n(f.efectivo),
    tarjeta: n(f.tarjeta),
    transferencia: n(f.transferencia),
    descuentoPromocion: n(f.descuento_promocion),
    descuentoManual: n(f.descuento_manual),
    puntosUsados: 0, // llega con el canje de puntos
    financiamiento: n(f.financiamiento),
    financiada: Boolean(f.financiada),
    articulos,
  };
}

const porForma = (filas, sucursalId) => {
  const r = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const x of filas) if (n(x.sucursal_id) === sucursalId) r[x.forma] = c(x.monto);
  return r;
};

// Une todo en la respuesta del reporte. Cada sucursal elegida aparece, aunque no haya vendido.
export function respuestaVentas({ filas, grupos, pagos, devoluciones, atras, sucursales, consulta, total, resumenes = null }) {
  const porSucursal = sucursales.map((s) => {
    const sid = n(s.id);
    const g = grupos.find((x) => n(x.sucursal_id) === sid) ?? {};
    const cobrado = porForma(pagos, sid);
    const devuelto = porForma(devoluciones, sid);
    const neto = {
      efectivo: aMonto(cobrado.efectivo - devuelto.efectivo),
      tarjeta: aMonto(cobrado.tarjeta - devuelto.tarjeta),
      transferencia: aMonto(cobrado.transferencia - devuelto.transferencia),
    };
    return {
      sucursalId: sid,
      sucursal: s.nombre,
      notas: n(g.notas),
      canceladas: n(g.canceladas),
      vendido: n(g.vendido),
      vendidoNotas: n(g.vendido_notas),
      vendidoVentas: n(g.vendido_ventas),
      abonado: n(g.abonado),
      pendiente: n(g.pendiente),
      iva: n(g.iva),
      descuentoPromocion: n(g.descuento_promocion),
      descuentoManual: n(g.descuento_manual),
      financiamiento: n(g.financiamiento),
      entro: { ...neto, total: aMonto(c(neto.efectivo) + c(neto.tarjeta) + c(neto.transferencia)) },
    };
  });

  const cifras = {
    notas: porSucursal.reduce((s, x) => s + x.notas, 0),
    canceladas: porSucursal.reduce((s, x) => s + x.canceladas, 0),
    vendido: suma(porSucursal, 'vendido'),
    vendidoNotas: suma(porSucursal, 'vendidoNotas'),
    vendidoVentas: suma(porSucursal, 'vendidoVentas'),
    abonado: suma(porSucursal, 'abonado'),
    pendiente: suma(porSucursal, 'pendiente'),
    iva: suma(porSucursal, 'iva'),
    descuentoPromocion: suma(porSucursal, 'descuentoPromocion'),
    descuentoManual: suma(porSucursal, 'descuentoManual'),
    puntosUsados: 0,
    financiamiento: suma(porSucursal, 'financiamiento'),
    entro: {
      efectivo: aMonto(porSucursal.reduce((s, x) => s + c(x.entro.efectivo), 0)),
      tarjeta: aMonto(porSucursal.reduce((s, x) => s + c(x.entro.tarjeta), 0)),
      transferencia: aMonto(porSucursal.reduce((s, x) => s + c(x.entro.transferencia), 0)),
      total: aMonto(porSucursal.reduce((s, x) => s + c(x.entro.total), 0)),
    },
    porCobrarAnteriores: { notas: atras.notas, monto: atras.monto },
  };

  return {
    periodo: { desde: consulta.desde, hasta: consulta.hasta },
    cifras,
    porSucursal,
    datos: filas.map((f) => filaVenta(f, resumenes?.get(String(f.id)) ?? null)),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
  };
}