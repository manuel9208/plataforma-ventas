export const servicioCaja = (f) => ({
  id: f.id,
  sku: f.sku,
  nombre: f.nombre,
  descripcion: f.descripcion,
  departamento: f.departamento,
  departamentoId: Number(f.departamento_id),
  tasa: Number(f.tasa ?? 0),
  tiempoDias: f.tiempo_estimado_horas == null ? null : Math.round(f.tiempo_estimado_horas / 24),
  precios: f.precios.map((p) => ({ tipoArticuloId: p.tipoArticuloId, tipo: p.tipo, precio: Number(p.precio) })),
  extras: f.extras.map((x) => ({ id: x.id, nombre: x.nombre, precio: Number(x.precio), tasa: Number(x.tasa ?? 0) })),
});