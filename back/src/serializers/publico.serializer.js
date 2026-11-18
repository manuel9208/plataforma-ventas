const num = (v) => (v === null || v === undefined ? null : Number(v));

export const sucursal = (f) => ({
  id: f.id,
  nombre: f.nombre,
  direccion: f.direccion,
  lat: num(f.lat),
  lon: num(f.lon),
});

export const producto = (f) => ({
  id: f.id,
  nombre: f.nombre,
  marca: f.marca,
  descripcion: f.descripcion,
  departamento: f.departamento,
  entregaDias: null,
  precios: f.precios.map((p) => ({ nombre: p.nombre, precio: Number(p.precio) })),
});

export const servicio = (f) => ({
  id: f.id,
  nombre: f.nombre,
  marca: null,
  descripcion: f.descripcion,
  departamento: f.departamento,
  entregaDias: f.tiempo_estimado_horas == null ? null : Math.round(f.tiempo_estimado_horas / 24),
  precios: f.precios.map((p) => ({ nombre: p.tipo, precio: Number(p.precio) })),
});