import { useMemo, useState } from 'react';
import {
  aCentavos,
  aMonto,
  aplicarPromocionesAPartidas,
  calcularLineaVenta,
  siguienteMayoreo,
  totalAhorro,
  totalesVenta,
} from '@plataforma/calculos';

export const MAX_ARTICULOS = 25;
export const MAX_SERVICIOS_ARTICULO = 10;
export const MAX_SERVICIOS_NOTA = 50;

let contador = 0;
const nuevaClave = (prefijo) => `${prefijo}${++contador}`;
const SIN_PROMOCIONES = [];
const SIN_MANUAL = { lineas: {}, motivo: '', autorizacion: null };
const SIN_FINANCIAMIENTO = { disponible: false, cargo: 0 };
const sumaC = (valores) => valores.reduce((s, v) => s + aCentavos(v), 0);

const nuevoServicio = (servicio, precio, s = {}) => ({
  clave: nuevaClave('v'),
  servicio,
  precio,
  extraIds: s.extraIds ?? [],
  fechaPrometida: s.fechaPrometida ?? null,
  fechaMostrada: s.fechaMostrada,
});

// Productos: un renglón por presentación. Servicios: artículos (unos tenis) con uno o varios servicios cada uno.
// Los importes salen de las MISMAS funciones que usa el servidor; el servidor vuelve a calcular todo al cobrar.
export function useCarrito(incluyeIva, promociones = SIN_PROMOCIONES, financiamiento = SIN_FINANCIAMIENTO) {
  const puedeFinanciar = financiamiento.disponible === true;
  const cargoFin = Number(financiamiento.cargo) || 0;
  const [financiarNota, setFinanciarNota] = useState(false);
  const [renglones, setRenglones] = useState([]);
  // [{ clave: 'a#', datos, comentario, servicios: [{ clave: 'v#', servicio, precio, extraIds, fechaPrometida, fechaMostrada }] }]
  const [articulos, setArticulos] = useState([]);
  const [cliente, setCliente] = useState(null); // { envio, vista } o null
  // Descuento manual: { lineas: { claveDelRenglón: porcentaje }, motivo, autorizacion }
  const [manual, setManual] = useState(SIN_MANUAL);

  const numServicios = articulos.reduce((n, g) => n + g.servicios.length, 0);
  // Financiada solo si la sucursal y el empleado pueden y hay servicios en la nota
  const financiada = puedeFinanciar && financiarNota && numServicios > 0;

  const motivoLimite =
    articulos.length >= MAX_ARTICULOS
      ? `Máximo ${MAX_ARTICULOS} artículos por nota.`
      : numServicios >= MAX_SERVICIOS_NOTA
        ? `Máximo ${MAX_SERVICIOS_NOTA} servicios por nota.`
        : '';

  const motivoServicio = (claveArticulo) => {
    const g = articulos.find((x) => x.clave === claveArticulo);
    if (g && g.servicios.length >= MAX_SERVICIOS_ARTICULO) return `Máximo ${MAX_SERVICIOS_ARTICULO} servicios por artículo.`;
    return numServicios >= MAX_SERVICIOS_NOTA ? `Máximo ${MAX_SERVICIOS_NOTA} servicios por nota.` : '';
  };

  const motivoDuplicar = (claveArticulo) => {
    const g = articulos.find((x) => x.clave === claveArticulo);
    if (articulos.length >= MAX_ARTICULOS) return `Máximo ${MAX_ARTICULOS} artículos por nota.`;
    if (g && numServicios + g.servicios.length > MAX_SERVICIOS_NOTA) return `Máximo ${MAX_SERVICIOS_NOTA} servicios por nota.`;
    return '';
  };

  const quitarDescuento = (clave) =>
    setManual((m) => {
      const lineas = { ...m.lineas };
      delete lineas[clave];
      return Object.keys(lineas).length ? { ...m, lineas } : SIN_MANUAL;
    });

  const ponerDescuento = (claves, porcentaje, auth) =>
    setManual((m) => ({
      lineas: { ...m.lineas, ...Object.fromEntries(claves.map((c) => [c, porcentaje])) },
      motivo: auth.motivo,
      autorizacion: { ...(auth.telefono ? { telefono: auth.telefono } : {}), pin: auth.pin },
    }));

  const ponerAutorizacion = (auth) =>
    setManual((m) => ({ ...m, motivo: auth.motivo, autorizacion: { ...(auth.telefono ? { telefono: auth.telefono } : {}), pin: auth.pin } }));

  const limpiarAutorizacion = () => setManual((m) => ({ ...m, autorizacion: null }));

  // ---------- Productos ----------
  const agregar = (producto, presentacion, cantidad = 1) =>
    setRenglones((actuales) => {
      const i = actuales.findIndex((r) => r.presentacion.id === presentacion.id);
      if (i === -1) return [...actuales, { producto, presentacion, cantidad }];
      const copia = [...actuales];
      copia[i] = { ...copia[i], cantidad: Number((copia[i].cantidad + cantidad).toFixed(3)) };
      return copia;
    });

  const poner = (presentacionId, cantidad) =>
    setRenglones((actuales) =>
      actuales.map((r) => (r.presentacion.id === presentacionId ? { ...r, cantidad: Number(Number(cantidad).toFixed(3)) } : r))
    );

  const quitar = (presentacionId) => {
    setRenglones((actuales) => actuales.filter((r) => r.presentacion.id !== presentacionId));
    quitarDescuento(`p${presentacionId}`);
  };

  // ---------- Artículos y servicios ----------
  // art: { datos, comentario } · s: { servicio, precio, extraIds, fechaPrometida, fechaMostrada }
  const agregarArticulo = (art, s) =>
    setArticulos((a) => [
      ...a,
      { clave: nuevaClave('a'), datos: art.datos, comentario: art.comentario ?? '', servicios: [nuevoServicio(s.servicio, s.precio, s)] },
    ]);

  // Un artículo guardado del cliente: entra con todos sus servicios de una vez
  const agregarArticuloConServicios = (art, lista) =>
    setArticulos((a) => [
      ...a,
      {
        clave: nuevaClave('a'),
        datos: art.datos,
        comentario: art.comentario ?? '',
        servicios: lista.map((s) => nuevoServicio(s.servicio, s.precio, s)),
      },
    ]);

  const editarDatos = (claveArticulo, art) =>
    setArticulos((a) => a.map((g) => (g.clave === claveArticulo ? { ...g, datos: art.datos, comentario: art.comentario ?? '' } : g)));

  const agregarServicio = (claveArticulo, s) =>
    setArticulos((a) =>
      a.map((g) => (g.clave === claveArticulo ? { ...g, servicios: [...g.servicios, nuevoServicio(s.servicio, s.precio, s)] } : g))
    );

  const editarServicio = (claveServicio, s) =>
    setArticulos((a) =>
      a.map((g) => ({
        ...g,
        servicios: g.servicios.map((x) =>
          x.clave === claveServicio ? { ...x, extraIds: s.extraIds, fechaPrometida: s.fechaPrometida, fechaMostrada: s.fechaMostrada } : x
        ),
      }))
    );

  // Si el artículo se queda sin servicios, se quita completo
  const quitarServicio = (claveServicio) => {
    setArticulos((a) =>
      a.map((g) => ({ ...g, servicios: g.servicios.filter((x) => x.clave !== claveServicio) })).filter((g) => g.servicios.length)
    );
    quitarDescuento(claveServicio);
  };

  const quitarArticulo = (claveArticulo) => {
    const g = articulos.find((x) => x.clave === claveArticulo);
    setArticulos((a) => a.filter((x) => x.clave !== claveArticulo));
    g?.servicios.forEach((s) => quitarDescuento(s.clave));
  };

  const duplicarArticulo = (claveArticulo) => {
    if (motivoDuplicar(claveArticulo)) return;
    setArticulos((a) => {
      const i = a.findIndex((x) => x.clave === claveArticulo);
      if (i === -1) return a;
      const g = a[i];
      const copia = [...a];
      copia.splice(i + 1, 0, {
        clave: nuevaClave('a'),
        datos: { ...g.datos },
        comentario: g.comentario,
        servicios: g.servicios.map((s) => nuevoServicio(s.servicio, s.precio, s)),
      });
      return copia;
    });
  };

  const ponerCliente = (envio, vista) => setCliente(envio ? { envio, vista } : null);

  const vaciar = () => {
    setFinanciarNota(false);
    setRenglones([]);
    setArticulos([]);
    setCliente(null);
    setManual(SIN_MANUAL);
  };

  const calculado = useMemo(() => {
    // 1) Precio normal (con mayoreo)
    const base = renglones.map((r) => {
      const c = calcularLineaVenta({
        precioBase: r.presentacion.precio,
        mayoreo: r.presentacion.mayoreo,
        cantidad: r.cantidad,
        tasa: r.producto.tasa,
        incluyeIva,
      });
      return { ...r, ...c, clave: `p${r.presentacion.id}`, calc: c, proximoMayoreo: siguienteMayoreo(r.presentacion.mayoreo, r.cantidad) };
    });

    // Lista aplanada de servicios, en el mismo orden que el servidor (s0, s1, …)
    const serviciosBase = articulos.flatMap((g) => g.servicios).map((s) => {
      const principal = calcularLineaVenta({ precioBase: s.precio.precio, mayoreo: [], cantidad: 1, tasa: s.servicio.tasa, incluyeIva });
      const extras = s.extraIds
        .map((id) => s.servicio.extras.find((x) => x.id === id))
        .filter(Boolean)
        .map((x) => ({ ...x, ...calcularLineaVenta({ precioBase: x.precio, mayoreo: [], cantidad: 1, tasa: x.tasa, incluyeIva }) }));
      const cargo = financiada && cargoFin > 0 ? calcularLineaVenta({ precioBase: cargoFin, mayoreo: [], cantidad: 1, tasa: s.servicio.tasa, incluyeIva }) : null;
      return { ...s, base: principal, extras, cargo };
    });

    // 2) Promociones y descuento manual (misma función que el servidor)
    const manuales = {};
    base.forEach((l) => {
      if (manual.lineas[l.clave]) manuales[l.clave] = { porcentaje: manual.lineas[l.clave] };
    });
    serviciosBase.forEach((s, i) => {
      if (manual.lineas[s.clave]) manuales[`s${i}`] = { porcentaje: manual.lineas[s.clave] };
    });

    const final = aplicarPromocionesAPartidas({
      productos: base.map((l) => ({
        clave: l.clave,
        productoId: l.producto.id,
        presentacionId: l.presentacion.id,
        departamentoId: l.producto.departamentoId,
        unidad: l.presentacion.unidad,
        cantidad: l.cantidad,
        precioLista: l.presentacion.precio,
        precioAplicado: l.precioAplicado,
        tasa: l.producto.tasa,
        total: l.calc.total,
        calculada: l.calc,
      })),
      servicios: serviciosBase.map((s, i) => ({
        clave: `s${i}`,
        servicioId: s.servicio.id,
        tipoArticuloId: s.precio.tipoArticuloId,
        departamentoId: s.servicio.departamentoId,
        precioAplicado: s.precio.precio,
        tasa: s.servicio.tasa,
        total: s.base.total,
        calculada: s.base,
      })),
      promociones,
      manuales,
      incluyeIva,
    });

    // 3) Lo que se muestra en cada renglón
    const lineas = base.map((l) => {
      const partes = final.productos.filter((p) => p.clave === l.clave);
      return {
        ...l,
        total: aMonto(sumaC(partes.map((p) => p.total))),
        totalSinPromo: l.total,
        ahorro: totalAhorro(partes),
        manualPct: manual.lineas[l.clave] ?? null,
        partes: partes.map((p) => ({ cantidad: p.cantidad, total: p.total, promocion: p.promocionNombre ?? null, descuento: p.descuento ?? 0 })),
      };
    });

    const serviciosCalc = serviciosBase.map((s, i) => {
      const f = final.servicios[i];
      const extrasC = sumaC(s.extras.map((x) => x.total));
      const cargoC = s.cargo ? aCentavos(s.cargo.total) : 0;
      return {
        ...s,
        cargoFin: s.cargo ? s.cargo.total : 0,
        totalServicio: aMonto(aCentavos(f.total) + extrasC + cargoC),
        totalSinPromo: aMonto(aCentavos(s.base.total) + extrasC + cargoC),
        promocion: f.promocionNombre ?? null,
        descuento: f.descuento ?? 0,
        manualPct: manual.lineas[s.clave] ?? null,
      };
    });
    const porClave = new Map(serviciosCalc.map((s) => [s.clave, s]));

    const grupos = articulos.map((g) => {
      const servicios = g.servicios.map((s) => porClave.get(s.clave));
      return { clave: g.clave, datos: g.datos, comentario: g.comentario, servicios, total: aMonto(sumaC(servicios.map((s) => s.totalServicio))) };
    });

    const piezas = [
      ...final.productos.map((p) => p.calculada),
      ...final.servicios.map((s) => s.calculada),
      ...serviciosBase.flatMap((s) => [...s.extras, ...(s.cargo ? [s.cargo] : [])]),
    ];
    const totales = piezas.length ? totalesVenta(piezas) : { total: 0, subtotal: null, iva: null, desglosado: false };
    const totalServicios = aMonto(sumaC(serviciosCalc.map((s) => s.totalServicio)));
    const totalProductos = aMonto(aCentavos(totales.total) - aCentavos(totalServicios));

    // 4) Descuento manual hacia el servidor (servicioIndice = posición en la lista aplanada)
    const lineasManual = [
      ...base.filter((l) => manual.lineas[l.clave]).map((l) => ({ presentacionId: l.presentacion.id, porcentaje: manual.lineas[l.clave] })),
      ...serviciosBase.flatMap((s, i) => (manual.lineas[s.clave] ? [{ servicioIndice: i, porcentaje: manual.lineas[s.clave] }] : [])),
    ];
    const tieneDescuentoManual = lineasManual.length > 0;

    // 5) Artículos tal como los pide el servidor
    const articulosEnvio = articulos.map((g) => ({
      datos: Object.fromEntries(Object.entries(g.datos).filter(([, v]) => v !== '')),
      ...(g.comentario.trim() ? { comentario: g.comentario.trim() } : {}),
      servicios: g.servicios.map((s) => ({
        servicioId: s.servicio.id,
        tipoArticuloId: s.precio.tipoArticuloId,
        ...(s.fechaPrometida ? { fechaPrometida: s.fechaPrometida } : {}),
        extraIds: s.extraIds,
      })),
    }));

    return {
      lineas,
      grupos,
      articulosEnvio,
      totales,
      totalServicios,
      totalProductos,
      ahorro: totalAhorro([...final.productos, ...final.servicios]),
      tieneDescuentoManual,
      faltaAutorizacion: tieneDescuentoManual && !manual.autorizacion,
      descuentoManual:
        tieneDescuentoManual && manual.autorizacion ? { motivo: manual.motivo, autorizacion: manual.autorizacion, lineas: lineasManual } : null,
      claves: [...base.map((l) => l.clave), ...serviciosBase.map((s) => s.clave)],
    };
  }, [renglones, articulos, incluyeIva, promociones, manual, financiada, cargoFin]);

  return {
    ...calculado,
    vacio: renglones.length === 0 && articulos.length === 0,
    tieneServicios: articulos.length > 0,
    numServicios,
    puedeFinanciar,
    financiada,
    cargoFinanciamiento: cargoFin,
    ponerFinanciada: setFinanciarNota,
    motivoLimite,
    motivoServicio,
    motivoDuplicar,
    motivoManual: manual.motivo,
    cliente,
    ponerCliente,
    porcentajeDe: (clave) => manual.lineas[clave] ?? null,
    agregar,
    poner,
    quitar,
    agregarArticulo,
    agregarArticuloConServicios,
    editarDatos,
    agregarServicio,
    editarServicio,
    quitarServicio,
    quitarArticulo,
    duplicarArticulo,
    ponerDescuento,
    quitarDescuento,
    ponerAutorizacion,
    limpiarAutorizacion,
    vaciar,
  };
}