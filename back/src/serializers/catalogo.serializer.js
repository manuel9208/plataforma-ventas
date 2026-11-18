export const departamento = (f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, activo: f.activo });

export const tipoArticulo = (f) => ({ id: f.id, nombre: f.nombre, orden: f.orden, activo: f.activo });

// NUMERIC llega como texto desde la base: se convierte a número
export const tasaIva = (f) => ({
  id: f.id,
  nombre: f.nombre,
  porcentaje: Number(f.porcentaje),
  esDefecto: f.es_defecto,
  activo: f.activo,
});

export const config = (f) => ({
  preciosIncluyenIva: f.precios_incluyen_iva,
  permitirVentaSinExistencia: f.permitir_venta_sin_existencia,
});