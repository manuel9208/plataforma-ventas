// Convierte el detalle de una venta de mostrador a la forma que dibuja TicketVenta
export const ventaATicket = (v) => ({
  ...v,
  tieneServicios: false,
  servicios: [],
  estadoPago: v.saldo > 0 ? 'abonada' : 'pagada',
  partidas: v.productos.map((p, i) => ({
    orden: i,
    tipo: 'producto',
    nombre: p.nombre,
    cantidad: p.cantidad,
    unidad: p.unidad,
    precioAplicado: p.precio,
    origenPrecio: p.origenPrecio,
    total: p.total,
  })),
  pagos: v.pagos.map((p) => ({ ...p, cambio: 0 })),
  pinEntrega: null,
  tienePin: false,
  // Con devoluciones el total que se imprime es el de lo que se vendió; lo devuelto va en el detalle
  total: v.total,
});