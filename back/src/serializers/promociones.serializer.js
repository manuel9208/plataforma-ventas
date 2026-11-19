import { estadoPromocion } from '@plataforma/calculos';

const num = (v) => (v === null || v === undefined ? null : Number(v));

function base(f, zona) {
  const campos = {
    tipo: f.tipo,
    encendida: f.encendida,
    desde: f.desde,
    hasta: f.hasta,
    dias: f.dias,
    horaDesde: f.hora_desde,
    horaHasta: f.hora_hasta,
  };
  return {
    id: Number(f.id),
    nombre: f.nombre,
    ...campos,
    modo: f.modo,
    valor: num(f.valor),
    precioCombo: num(f.precio_combo),
    lleva: num(f.lleva),
    paga: num(f.paga),
    aplicaA: f.aplica_a,
    sucursalIds: (f.sucursal_ids ?? []).map(Number),
    creadaEn: f.creado_en,
    estado: estadoPromocion(campos, { zona }),
  };
}

export const promocionLista = (f, { zona, puedeEditar }) => ({ ...base(f, zona), puedeEditar });

export const promocionDetalle = (f, { objetivos, items, zona, puedeEditar }) => ({
  ...base(f, zona),
  puedeEditar,
  objetivos: objetivos.map((o) => ({
    tipo: o.departamento_id ? 'departamento' : o.producto_id ? 'producto' : 'servicio',
    id: Number(o.departamento_id ?? o.producto_id ?? o.servicio_id),
    nombre: o.nombre,
  })),
  items: items.map((i) => ({
    presentacionId: num(i.presentacion_id),
    servicioId: num(i.servicio_id),
    tipoArticuloId: num(i.tipo_articulo_id),
    cantidad: Number(i.cantidad),
    nombre: i.nombre,
    tipoArticulo: i.tipo_articulo,
  })),
});

export const opcion = (f) => ({ id: Number(f.id), nombre: f.nombre, sku: f.sku ?? null });