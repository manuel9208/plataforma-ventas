import { servicioCaja } from './cajaServicios.serializer.js';

const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

// g: lo guardado · sv: el servicio de hoy (formato del catálogo de Caja) · precio: su precio para ese tipo de artículo
// disponible: true (se puede agregar) · false (ya no existe o no está en la sucursal) · null (no se pudo revisar: sin turno)
export const serializarServicioGuardado = ({ g, sv, precio, disponible }) => {
  const base = { servicioId: g.servicioId, tipoArticuloId: g.tipoArticuloId, nombre: g.nombre, tipo: g.tipo, disponible };
  if (disponible !== true) return { ...base, extraIds: disponible === null ? (g.extraIds ?? []) : [] };

  const servicio = servicioCaja(sv);
  const extrasVigentes = new Set(servicio.extras.map((x) => x.id));
  return {
    ...base,
    nombre: `${servicio.nombre} · ${precio.tipo}`,
    tipo: precio.tipo,
    // Solo los extras que todavía existen
    extraIds: (g.extraIds ?? []).filter((id) => extrasVigentes.has(id)),
    // Todo lo que el carrito necesita para agregarlo sin otra consulta
    servicio,
    precio: { tipoArticuloId: Number(precio.tipoArticuloId), tipo: precio.tipo, precio: Number(precio.precio) },
  };
};

export const serializarClienteArticulo = (f, servicios) => ({
  id: f.id,
  datos: sinVacios({
    marca: f.marca,
    talla: f.talla,
    color: f.color,
    modelo: f.modelo,
    textura: f.textura,
    descripcion: f.descripcion,
  }),
  veces: f.veces,
  ultimaVez: f.ultima_vez,
  servicios: servicios.map(serializarServicioGuardado),
});