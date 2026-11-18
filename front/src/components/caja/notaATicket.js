// Convierte el detalle de una nota (API de notas) a la forma que dibuja TicketVenta
export const notaATicket = (n) => ({
  ...n,
  tieneServicios: true,
  partidas: n.productos.map((p, i) => ({
    orden: i,
    tipo: 'producto',
    nombre: p.nombre,
    cantidad: p.cantidad,
    unidad: p.unidad,
    precioAplicado: p.precio,
    origenPrecio: 'general',
    total: p.total,
  })),
  pagos: n.pagos.map((p) => ({ ...p, cambio: 0 })),
  pinEntrega: null,
});