const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));
const PENDIENTES = ['recibido', 'en_proceso', 'listo'];

// Ticket de entrega. Nunca lleva el PIN.
export function ticketEntrega(detalle, { entrega, articulos, extras }, repetida = false) {
  return {
    id: entrega.id,
    repetida,
    folio: detalle.folio,
    empresa: detalle.empresa,
    sucursal: detalle.sucursal,
    zonaHoraria: detalle.zonaHoraria,
    caja: entrega.caja,
    entrego: entrega.entrego,
    entregadaEn: entrega.creado_en,
    metodo: entrega.metodo,
    autorizo: entrega.autorizo ?? null,
    motivo: entrega.motivo ?? null,
    recoge: entrega.recoge_nombre ?? null,
    cliente: detalle.cliente ? { nombre: detalle.cliente.nombre, telefono: detalle.cliente.telefono } : null,
    articulos: articulos.map((a) => ({
      partidaId: a.id,
      nombre: a.nombre,
      tipoArticulo: a.tipo_articulo_nombre,
      articulo: sinVacios({ marca: a.marca, talla: a.talla, color: a.color, modelo: a.modelo, textura: a.textura, descripcion: a.descripcion }),
      extras: extras.filter((x) => x.padre_partida_id === a.id).map((x) => x.nombre),
    })),
    pendientes: detalle.servicios.filter((s) => PENDIENTES.includes(s.estado)).length,
    pieEntrega: detalle.pieEntrega,
  };
}