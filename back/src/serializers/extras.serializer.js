// NUMERIC llega como texto desde la base: se convierte a número
export const extra = (f) => ({
  id: f.id,
  nombre: f.nombre,
  precio: Number(f.precio),
  tasaIvaId: f.tasa_iva_id,
  activo: f.activo,
});

export const extraDetalle = (f, precios) => ({
  ...extra(f),
  preciosSucursal: Object.fromEntries(precios.map((r) => [r.sucursal_id, Number(r.precio)])),
});