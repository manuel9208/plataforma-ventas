let contador = 0;
const nuevaClave = () => ++contador;

// Nombre automático de una presentación: "Cartón de 12"
export const nombrePresentacion = (unidades, unidad, factor) => {
  const n = unidades.find((u) => u.clave === unidad)?.nombre ?? unidad;
  return factor ? `${n} de ${factor}` : n;
};

export const presentacionNueva = ({ nombre = '', unidad = 'carton', factor = '', esBase = false } = {}) => ({
  _k: nuevaClave(),
  nombre,
  unidad,
  factor: String(factor),
  precio: '',
  esBase,
  codigos: [],
  codigoInterno: null,
  generarInterno: false,
  preciosSucursal: {},
  mayoreo: [],
});

const desdeProducto = (p) => ({
  _k: nuevaClave(),
  id: p.id,
  nombre: p.nombre,
  unidad: p.unidad,
  factor: String(p.factor),
  precio: p.precio === null ? '' : String(p.precio),
  esBase: p.esBase,
  codigos: p.codigos.filter((c) => !c.esInterno).map((c) => c.codigo),
  codigoInterno: p.codigos.find((c) => c.esInterno)?.codigo ?? null,
  generarInterno: false,
  preciosSucursal: Object.fromEntries(Object.entries(p.preciosSucursal).map(([sid, v]) => [sid, String(v)])),
  mayoreo: (p.mayoreo ?? []).map((r) => ({
    _k: `m${nuevaClave()}`,
    cantidadMinima: String(r.cantidadMinima),
    precio: String(r.precio),
  })),
});

export function estadoInicial(producto, opciones) {
  if (producto) {
    return {
      nombre: producto.nombre,
      marca: producto.marca ?? '',
      descripcion: producto.descripcion ?? '',
      departamentoId: String(producto.departamento.id),
      tasaIvaId: String(producto.tasaIvaId),
      unidadBase: producto.unidadBase,
      costo: producto.costo === null || producto.costo === undefined ? '' : String(producto.costo),
      mermaEsperadaPct: String(producto.mermaEsperadaPct),
      controlaInventario: producto.controlaInventario,
      llevaCaducidad: producto.llevaCaducidad,
      visiblePublico: producto.visiblePublico,
      presentaciones: producto.presentaciones.map(desdeProducto),
      sucursales: Object.fromEntries(
        producto.sucursales.map((s) => [String(s.sucursalId), { stockMinimo: String(s.stockMinimo) }])
      ),
    };
  }
  const tasa = opciones.tasasIva.find((t) => t.esDefecto) ?? opciones.tasasIva[0];
  return {
    nombre: '',
    marca: '',
    descripcion: '',
    departamentoId: String(opciones.departamentos[0]?.id ?? ''),
    tasaIvaId: String(tasa?.id ?? ''),
    unidadBase: 'pieza',
    costo: '',
    mermaEsperadaPct: '0',
    controlaInventario: true,
    llevaCaducidad: false,
    visiblePublico: true,
    presentaciones: [presentacionNueva({ nombre: 'Pieza', unidad: 'pieza', factor: 1, esBase: true })],
    sucursales:
      opciones.sucursales.length === 1 ? { [String(opciones.sucursales[0].id)]: { stockMinimo: '0' } } : {},
  };
}

// Convierte el formulario en lo que recibe la API
export function armarDatos(f, { editando, puedeVerCostos }) {
  const sucursalesElegidas = Object.keys(f.sucursales);

  const datos = {
    nombre: f.nombre.trim(),
    departamentoId: Number(f.departamentoId),
    tasaIvaId: Number(f.tasaIvaId),
    unidadBase: f.unidadBase,
    mermaEsperadaPct: Number(f.mermaEsperadaPct || 0),
    controlaInventario: f.controlaInventario,
    llevaCaducidad: f.llevaCaducidad,
    visiblePublico: f.visiblePublico,
    presentaciones: f.presentaciones.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      nombre: p.nombre.trim(),
      unidad: p.unidad,
      factor: Number(p.factor),
      precio: p.precio === '' ? null : Number(p.precio),
      esBase: p.esBase,
      codigos: p.codigos,
      generarInterno: p.generarInterno,
      preciosSucursal: Object.fromEntries(
        Object.entries(p.preciosSucursal)
          .filter(([sid, v]) => v !== '' && sucursalesElegidas.includes(sid))
          .map(([sid, v]) => [sid, Number(v)])
      ),
      mayoreo: p.mayoreo.map((r) => ({ cantidadMinima: Number(r.cantidadMinima), precio: Number(r.precio) })),
    })),
    sucursales: Object.entries(f.sucursales).map(([sid, s]) => ({
      sucursalId: Number(sid),
      stockMinimo: Number(s.stockMinimo || 0),
    })),
  };

  // Opcionales: al crear se omiten si están vacíos; al editar, vacío borra el dato
  for (const [clave, valor] of [['marca', f.marca.trim()], ['descripcion', f.descripcion.trim()]]) {
    if (valor) datos[clave] = valor;
    else if (editando) datos[clave] = null;
  }
  if (puedeVerCostos) {
    if (f.costo !== '') datos.costo = Number(f.costo);
    else if (editando) datos.costo = null;
  }
  return datos;
}