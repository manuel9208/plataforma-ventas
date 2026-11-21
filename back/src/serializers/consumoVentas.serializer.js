import { aCentavos, aMonto, estadoDeNota } from '@plataforma/calculos';

const n = (v) => Number(v ?? 0);
const c = (v) => Math.round(aCentavos(n(v)));
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));
const porcentaje = (parteC, totalC) => (totalC > 0 ? Math.round((parteC * 1000) / totalC) / 10 : 0);

const ordenar = (lista, orden) =>
  [...lista].sort((a, b) => (orden === 'dinero' ? b.dinero - a.dinero || b.cantidad - a.cantidad : b.cantidad - a.cantidad || b.dinero - a.dinero));

// Productos y extras: la consulta ya trae el total y el orden
function bloquePlano(filas) {
  const dineroTotal = n(filas[0]?.dinero_total);
  return {
    items: filas.map((f) => ({
      id: n(f.id),
      nombre: f.nombre,
      unidad: f.unidad ?? null,
      cantidad: n(f.cantidad),
      dinero: n(f.dinero),
      notas: n(f.notas),
      porcentaje: porcentaje(c(f.dinero), c(dineroTotal)),
    })),
    total: n(filas[0]?.renglones),
    dinero: dineroTotal,
  };
}

function bloqueServicios(filas, orden, limite) {
  const totales = filas.filter((f) => n(f.es_total) === 1);
  const tipos = filas.filter((f) => n(f.es_total) === 0);
  const todos = totales.map((t) => ({
    id: n(t.id),
    nombre: t.nombre,
    cantidad: n(t.cantidad),
    dinero: n(t.dinero),
    notas: n(t.notas),
    porTipo: tipos
      .filter((x) => n(x.id) === n(t.id))
      .map((x) => ({ tipo: x.tipo, cantidad: n(x.cantidad), dinero: n(x.dinero) }))
      .sort((a, b) => b.cantidad - a.cantidad),
  }));
  const dineroC = todos.reduce((s, x) => s + c(x.dinero), 0);
  return {
    items: ordenar(todos, orden)
      .slice(0, limite)
      .map((x) => ({ ...x, porcentaje: porcentaje(c(x.dinero), dineroC) })),
    total: todos.length,
    dinero: aMonto(dineroC),
    veces: todos.reduce((s, x) => s + x.cantidad, 0),
  };
}

export const respuestaConsumo = ({ productos, servicios, extras, orden, limite }) => ({
  orden,
  productos: bloquePlano(productos),
  servicios: bloqueServicios(servicios, orden, limite),
  extras: bloquePlano(extras),
});

// "Limpieza premium · tenis, Cera ×2": lo que consumió cada nota, para la columna de la tabla
export function resumenesPorVenta(filas) {
  const por = new Map();
  for (const f of filas) {
    const cantidad = n(f.cantidad);
    if (!(cantidad > 0)) continue;
    const texto = f.tipo === 'servicio' ? f.nombre : `${f.nombre} ×${Number(cantidad.toFixed(3))}`;
    const id = String(f.venta_id);
    por.set(id, [...(por.get(id) ?? []), texto]);
  }
  return new Map(
    [...por].map(([id, lista]) => {
      const t = lista.join(', ');
      return [id, t.length > 300 ? `${t.slice(0, 297)}…` : t];
    })
  );
}

// Una nota con lo que consumió. El comentario interno solo lo ve quien tiene el reporte.
export function detalleVenta({ venta: v, partidas }) {
  const servicios = partidas
    .filter((p) => p.tipo === 'servicio')
    .map((f) => ({
      partidaId: f.id,
      articuloId: f.venta_articulo_id ?? null,
      comentario: f.comentario ?? null,
      nombre: f.nombre,
      estado: f.estado_trabajo,
      quitado: Boolean(f.quitado),
      // Sin el cargo de financiamiento: es lo que vale el servicio
      total: aMonto(c(f.total) - c(f.cargo_financiamiento)),
      articulo: sinVacios({ marca: f.marca, talla: f.talla, color: f.color, modelo: f.modelo, textura: f.textura, descripcion: f.descripcion }),
      extras: partidas
        .filter((x) => x.tipo === 'extra' && x.padre_partida_id === f.id)
        .map((x) => ({ nombre: x.nombre, total: n(x.total), quitado: Boolean(x.quitado) })),
    }));

  const productos = partidas
    .filter((p) => p.tipo === 'producto')
    .map((f) => ({
      nombre: f.nombre,
      unidad: f.unidad,
      cantidadOriginal: n(f.cantidad),
      devuelta: n(f.cantidad_devuelta),
      cantidad: f.quitado ? 0 : Number((n(f.cantidad) - n(f.cantidad_devuelta)).toFixed(3)),
      total: f.quitado ? 0 : aMonto(c(f.total) - c(f.valor_devuelto)),
      quitado: Boolean(f.quitado),
    }));

  const cancelada = n(v.total) > 0 && n(v.cancelado) >= n(v.total);
  return {
    id: v.id,
    folio: v.folio,
    sucursal: v.sucursal,
    cajero: v.cajero,
    fecha: v.creado_en,
    zonaHoraria: v.zona,
    cliente: v.cliente_nombre ? { nombre: v.cliente_nombre, telefono: v.cliente_telefono } : null,
    tipo: v.tiene_servicios ? 'Nota de servicio' : 'Venta de mostrador',
    estado: cancelada ? 'cancelada' : v.tiene_servicios ? estadoDeNota(servicios.map((s) => s.estado)) : 'venta',
    total: n(v.total),
    cancelado: n(v.cancelado),
    servicios,
    productos,
  };
}