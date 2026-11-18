// NUMERIC llega como texto desde la base: se convierte a número
const num = (v) => (v === null || v === undefined ? null : Number(v));

// Detalle completo (para editar). El costo solo sale con permiso.
export function producto(d, { verCostos = false } = {}) {
  return {
    id: d.id,
    sku: d.sku,
    nombre: d.nombre,
    descripcion: d.descripcion,
    marca: d.marca,
    departamento: { id: d.departamento_id, codigo: d.departamento_codigo, nombre: d.departamento_nombre },
    tasaIvaId: d.tasa_iva_id,
    unidadBase: d.unidad_base,
    mermaEsperadaPct: Number(d.merma_esperada_pct),
    controlaInventario: d.controla_inventario,
    llevaCaducidad: d.lleva_caducidad,
    visiblePublico: d.visible_publico,
    activo: d.activo,
    baja: d.activo ? null : { fecha: d.baja_en, motivo: d.baja_motivo },
    ...(verCostos ? { costo: num(d.costo_ultimo) } : {}),
    presentaciones: d.presentaciones.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      factor: Number(p.factor),
      precio: num(p.precio),
      seVende: p.se_vende,
      seCompra: p.se_compra,
      esBase: p.es_base,
      codigos: d.codigos
        .filter((c) => c.presentacion_id === p.id)
        .map((c) => ({ codigo: c.codigo, esInterno: c.es_interno })),
      preciosSucursal: Object.fromEntries(
        d.precios.filter((x) => x.presentacion_id === p.id).map((x) => [x.sucursal_id, Number(x.precio)])
      ),
      mayoreo: d.volumen
        .filter((v) => v.presentacion_id === p.id)
        .map((v) => ({ cantidadMinima: Number(v.cantidad_minima), precio: Number(v.precio) })),
    })),
    sucursales: d.sucursales.map((s) => ({ sucursalId: s.sucursal_id, stockMinimo: Number(s.stock_minimo) })),
    creadoEn: d.creado_en,
    actualizadoEn: d.actualizado_en,
  };
}

// Resumen para la lista
export function productoLista(f, { verCostos = false } = {}) {
  return {
    id: f.id,
    sku: f.sku,
    nombre: f.nombre,
    marca: f.marca,
    departamento: { id: f.departamento_id, nombre: f.departamento_nombre },
    unidadBase: f.unidad_base,
    activo: f.activo,
    visiblePublico: f.visible_publico,
    controlaInventario: f.controla_inventario,
    ...(verCostos ? { costo: num(f.costo_ultimo) } : {}),
    presentaciones: f.presentaciones,
  };
}