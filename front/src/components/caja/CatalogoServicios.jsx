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

let contador = 0;
const nuevaClave = () => `a${++contador}`;
const SIN_PROMOCIONES = [];
const SIN_MANUAL = { lineas: {}, motivo: '', autorizacion: null };
const sumaC = (valores) => valores.reduce((s, v) => s + aCentavos(v), 0);

// Productos: un renglón por presentación. Servicios: un renglón por artículo (con sus extras).
// Los importes salen de las MISMAS funciones que usa el servidor (shared/calculos); el servidor vuelve a calcular todo al cobrar.
export function useCarrito(incluyeIva, promociones = SIN_PROMOCIONES) {
  const [renglones, setRenglones] = useState([]);
  const [articulos, setArticulos] = useState([]);
  // Descuento manual: { lineas: { claveDelRenglón: porcentaje }, motivo, autorizacion: { telefono?, pin } | null }
  const [manual, setManual] = useState(SIN_MANUAL);

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

  // datos: { articulo, extraIds, fechaPrometida, fechaMostrada }
  const agregarArticulo = (servicio, precio, datos) =>
    setArticulos((a) => [...a, { clave: nuevaClave(), servicio, precio, ...datos }]);

  const editarArticulo = (clave, datos) => setArticulos((a) => a.map((x) => (x.clave === clave ? { ...x, ...datos } : x)));

  const duplicarArticulo = (clave) =>
    setArticulos((a) => {
      const i = a.findIndex((x) => x.clave === clave);
      if (i === -1) return a;
      const copia = [...a];
      copia.splice(i + 1, 0, { ...a[i], clave: nuevaClave(), articulo: { ...a[i].articulo }, extraIds: [...a[i].extraIds] });
      return copia;
    });

  const quitarArticulo = (clave) => {
    setArticulos((a) => a.filter((x) => x.clave !== clave));
    quitarDescuento(clave);
  };

  const vaciar = () => {
    setRenglones([]);
    setArticulos([]);
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

    const notasBase = articulos.map((a) => {
      const principal = calcularLineaVenta({ precioBase: a.precio.precio, mayoreo: [], cantidad: 1, tasa: a.servicio.tasa, incluyeIva });
      const extras = a.extraIds
        .map((id) => a.servicio.extras.find((x) => x.id === id))
        .filter(Boolean)
        .map((x) => ({ ...x, ...calcularLineaVenta({ precioBase: x.precio, mayoreo: [], cantidad: 1, tasa: x.tasa, incluyeIva }) }));
      return { ...a, base: principal, extras };
    });

    // 2) Promociones y descuento manual (misma función que el servidor; los servicios van por posición, igual que en el servidor)
    const manuales = {};
    base.forEach((l) => {
      if (manual.lineas[l.clave]) manuales[l.clave] = { porcentaje: manual.lineas[l.clave] };
    });
    notasBase.forEach((n, i) => {
      if (manual.lineas[n.clave]) manuales[`s${i}`] = { porcentaje: manual.lineas[n.clave] };
    });

    const final = aplicarPromocionesAPartidas({
      productos: base.map((l) => ({
        clave: l.clave,
        productoId: l.producto.id,
        presentacionId: l.presentacion.id,
        departamentoId: l.producto.departamentoId,
        cantidad: l.cantidad,
        precioLista: l.presentacion.precio,
        precioAplicado: l.precioAplicado,
        tasa: l.producto.tasa,
        total: l.calc.total,
        calculada: l.calc,
      })),
      servicios: notasBase.map((n, i) => ({
        clave: `s${i}`,
        servicioId: n.servicio.id,
        tipoArticuloId: n.precio.tipoArticuloId,
        departamentoId: n.servicio.departamentoId,
        precioAplicado: n.precio.precio,
        tasa: n.servicio.tasa,
        total: n.base.total,
        calculada: n.base,
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

    const notas = notasBase.map((n, i) => {
      const s = final.servicios[i];
      const extrasC = sumaC(n.extras.map((x) => x.total));
      return {
        ...n,
        totalArticulo: aMonto(aCentavos(s.total) + extrasC),
        totalSinPromo: aMonto(aCentavos(n.base.total) + extrasC),
        promocion: s.promocionNombre ?? null,
        descuento: s.descuento ?? 0,
        manualPct: manual.lineas[n.clave] ?? null,
      };
    });

    const piezas = [...final.productos.map((p) => p.calculada), ...final.servicios.map((s) => s.calculada), ...notasBase.flatMap((n) => n.extras)];
    const totales = piezas.length ? totalesVenta(piezas) : { total: 0, subtotal: null, iva: null, desglosado: false };
    const totalServicios = aMonto(sumaC(notas.map((n) => n.totalArticulo)));
    const totalProductos = aMonto(aCentavos(totales.total) - aCentavos(totalServicios));

    // 4) Lo que se manda al servidor para el descuento manual
    const lineasManual = [
      ...base.filter((l) => manual.lineas[l.clave]).map((l) => ({ presentacionId: l.presentacion.id, porcentaje: manual.lineas[l.clave] })),
      ...notasBase.flatMap((n, i) => (manual.lineas[n.clave] ? [{ servicioIndice: i, porcentaje: manual.lineas[n.clave] }] : [])),
    ];
    const tieneDescuentoManual = lineasManual.length > 0;

    return {
      lineas,
      notas,
      totales,
      totalServicios,
      totalProductos,
      ahorro: totalAhorro([...final.productos, ...final.servicios]),
      tieneDescuentoManual,
      faltaAutorizacion: tieneDescuentoManual && !manual.autorizacion,
      descuentoManual:
        tieneDescuentoManual && manual.autorizacion ? { motivo: manual.motivo, autorizacion: manual.autorizacion, lineas: lineasManual } : null,
      claves: [...base.map((l) => l.clave), ...notasBase.map((n) => n.clave)],
    };
  }, [renglones, articulos, incluyeIva, promociones, manual]);

  return {
    ...calculado,
    vacio: renglones.length === 0 && articulos.length === 0,
    tieneServicios: articulos.length > 0,
    motivoManual: manual.motivo,
    porcentajeDe: (clave) => manual.lineas[clave] ?? null,
    agregar,
    poner,
    quitar,
    agregarArticulo,
    editarArticulo,
    duplicarArticulo,
    quitarArticulo,
    ponerDescuento,
    quitarDescuento,
    ponerAutorizacion,
    limpiarAutorizacion,
    vaciar,
  };
}