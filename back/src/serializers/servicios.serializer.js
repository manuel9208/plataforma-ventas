const horasADias = (h) => (h === null || h === undefined ? null : Math.round(h / 24));

// Detalle completo (para editar)
export function servicio(d, { verContacto = false } = {}) {
  const preciosSucursal = {};
  for (const r of d.preciosSucursal) {
    (preciosSucursal[r.sucursal_id] ??= {})[r.tipo_articulo_id] = Number(r.precio);
  }
  return {
    id: d.id,
    sku: d.sku,
    nombre: d.nombre,
    descripcion: d.descripcion,
    departamento: { id: d.departamento_id, codigo: d.departamento_codigo, nombre: d.departamento_nombre },
    tasaIvaId: d.tasa_iva_id,
    tiempoDias: horasADias(d.tiempo_estimado_horas),
    visiblePublico: d.visible_publico,
    requiereCotizacion: d.requiere_cotizacion === true,
    ...(verContacto ? { contactoCotizacion: d.contacto_cotizacion ?? '' } : {}),
    activo: d.activo,
    baja: d.activo ? null : { fecha: d.baja_en, motivo: d.baja_motivo },
    precios: d.precios.map((p) => ({ tipoArticuloId: p.tipo_articulo_id, precio: Number(p.precio) })),
    sucursalIds: d.sucursales.map((s) => s.sucursal_id),
    preciosSucursal,
    extraIds: d.extras.map((x) => x.extra_id),
    creadoEn: d.creado_en,
    actualizadoEn: d.actualizado_en,
  };
}

// Resumen para la lista
export function servicioLista(f) {
  return {
    id: f.id,
    sku: f.sku,
    nombre: f.nombre,
    departamento: { id: f.departamento_id, nombre: f.departamento_nombre },
    tiempoDias: horasADias(f.tiempo_estimado_horas),
    visiblePublico: f.visible_publico,
    requiereCotizacion: f.requiere_cotizacion === true,
    activo: f.activo,
    precios: f.precios.map((p) => ({ tipoArticuloId: p.tipoArticuloId, tipo: p.tipo, precio: Number(p.precio) })),
  };
}