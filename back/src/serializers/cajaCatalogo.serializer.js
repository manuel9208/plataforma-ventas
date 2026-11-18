const presentacion = (p) => ({
  id: p.id,
  nombre: p.nombre,
  unidad: p.unidad,
  factor: Number(p.factor),
  precio: Number(p.precio),
  mayoreo: p.mayoreo.map((m) => ({ cantidadMinima: Number(m.cantidadMinima), precio: Number(m.precio) })),
});

export const productoCaja = (f) => ({
  id: f.id,
  sku: f.sku,
  nombre: f.nombre,
  marca: f.marca,
  departamento: f.departamento,
  departamentoId: Number(f.departamento_id),
  unidadBase: f.unidad_base,
  tasa: Number(f.tasa ?? 0),
  presentaciones: f.presentaciones.map(presentacion),
  presentacionEscaneada: f.presentacion_escaneada ?? null,
});