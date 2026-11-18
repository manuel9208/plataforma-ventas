// Estado inicial del formulario y armado de lo que se envía.
// precios: { [tipoId]: "150" }   sucursales: { [sucursalId]: { precios: { [tipoId]: "140" } } }

export function estadoInicial(servicio, opciones) {
  if (servicio) {
    return {
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      departamentoId: String(servicio.departamento.id),
      tasaIvaId: String(servicio.tasaIvaId),
      tiempoDias: servicio.tiempoDias === null ? '' : String(servicio.tiempoDias),
      visiblePublico: servicio.visiblePublico,
      precios: Object.fromEntries(servicio.precios.map((p) => [String(p.tipoArticuloId), String(p.precio)])),
      extraIds: servicio.extraIds,
      sucursales: Object.fromEntries(
        servicio.sucursalIds.map((sid) => [
          String(sid),
          {
            precios: Object.fromEntries(
              Object.entries(servicio.preciosSucursal[sid] ?? {}).map(([tid, v]) => [tid, String(v)])
            ),
          },
        ])
      ),
    };
  }
  const tasa = opciones.tasasIva.find((t) => t.esDefecto) ?? opciones.tasasIva[0];
  return {
    nombre: '',
    descripcion: '',
    departamentoId: String(opciones.departamentos[0]?.id ?? ''),
    tasaIvaId: String(tasa?.id ?? ''),
    tiempoDias: '',
    visiblePublico: true,
    precios: {},
    extraIds: [],
    sucursales: opciones.sucursales.length === 1 ? { [String(opciones.sucursales[0].id)]: { precios: {} } } : {},
  };
}

export function armarDatos(f, { editando, tipos }) {
  const precios = tipos
    .filter((t) => f.precios[t.id] !== undefined && f.precios[t.id] !== '')
    .map((t) => ({ tipoArticuloId: t.id, precio: Number(f.precios[t.id]) }));
  const conPrecio = new Set(precios.map((p) => String(p.tipoArticuloId)));

  const preciosSucursal = {};
  for (const [sid, s] of Object.entries(f.sucursales)) {
    const fila = {};
    for (const [tid, v] of Object.entries(s.precios)) {
      if (v !== '' && conPrecio.has(tid)) fila[tid] = Number(v);
    }
    if (Object.keys(fila).length) preciosSucursal[sid] = fila;
  }

  const datos = {
    nombre: f.nombre.trim(),
    departamentoId: Number(f.departamentoId),
    tasaIvaId: Number(f.tasaIvaId),
    visiblePublico: f.visiblePublico,
    precios,
    sucursalIds: Object.keys(f.sucursales).map(Number),
    preciosSucursal,
    extraIds: f.extraIds,
  };

  // Opcionales: al crear se omiten si están vacíos; al editar, vacío borra el dato
  const descripcion = f.descripcion.trim();
  if (descripcion) datos.descripcion = descripcion;
  else if (editando) datos.descripcion = null;

  if (f.tiempoDias !== '') datos.tiempoDias = Number(f.tiempoDias);
  else if (editando) datos.tiempoDias = null;

  return datos;
}