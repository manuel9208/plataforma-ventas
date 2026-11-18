import { aCentavos, aMonto } from './redondeo.js';
import { desglosarIva } from './impuestos.js';

const num = (v) => Number(v);

// Precio por pieza en centavos con un descuento. Nunca baja de 1 centavo.
export function precioConDescuentoC(baseC, modo, valor) {
  if (baseC <= 0) return baseC;
  const c = modo === 'porcentaje' ? Math.round((baseC * (100 - valor)) / 100) : baseC - Math.round(valor * 100);
  return Math.max(c, 1);
}

// Una partida cuyo total ya se conoce (con promoción). Misma forma que calcularPartida.
export function calcularPartidaConTotal({ totalC, tasa = 0, incluyeIva }) {
  const total = aMonto(totalC);
  if (!incluyeIva) return { total, subtotal: null, iva: null, desglosado: false };
  const { base, iva } = desglosarIva(total, tasa);
  return { total, subtotal: base, iva, desglosado: true };
}

function aplicaALinea(p, l) {
  if (p.aplicaA === 'todo') return true;
  return p.objetivos.some(
    (o) =>
      (o.tipo === 'departamento' && num(o.id) === num(l.departamentoId)) ||
      (o.tipo === 'producto' && l.productoId != null && num(o.id) === num(l.productoId)) ||
      (o.tipo === 'servicio' && l.servicioId != null && num(o.id) === num(l.servicioId))
  );
}

function coincide(item, l) {
  if (item.presentacionId != null) return l.presentacionId != null && num(item.presentacionId) === num(l.presentacionId);
  return (
    l.servicioId != null &&
    num(item.servicioId) === num(l.servicioId) &&
    (item.tipoArticuloId == null || num(item.tipoArticuloId) === num(l.tipoArticuloId))
  );
}

// Toma, de las piezas libres, las que pide el combo. null si no alcanzan.
function tomarPiezas(combo, estado) {
  const usados = new Map();
  const tomas = [];
  for (const item of combo.items) {
    let falta = item.cantidad;
    for (const e of estado) {
      if (!falta) break;
      if (e.manual || !e.linea.entera || !coincide(item, e.linea)) continue;
      const libres = e.libres - (usados.get(e) ?? 0);
      const n = Math.min(libres, falta);
      if (n > 0) {
        usados.set(e, (usados.get(e) ?? 0) + n);
        tomas.push({ e, cantidad: n });
        falta -= n;
      }
    }
    if (falta) return null;
  }
  return tomas;
}

// lineas: [{ clave, productoId, presentacionId, servicioId, tipoArticuloId, departamentoId, cantidad, entera,
//            baseC (precio de lista por pieza, sin mayoreo), unidadC (precio actual por pieza, con mayoreo) }]
// promociones: las vigentes. manuales: { [clave]: { porcentaje } }.
// Devuelve { [clave]: [{ cantidad, totalC, unidadC, descuentoC, promo }] }. Una línea se parte si una parte entra a un combo.
export function aplicarPromociones({ lineas, promociones = [], manuales = {} }) {
  const estado = lineas.map((l) => {
    const manual = manuales[l.clave];
    let mejor = { unidadC: l.unidadC, promo: null };
    if (manual) {
      mejor = {
        unidadC: precioConDescuentoC(l.baseC, 'porcentaje', manual.porcentaje),
        promo: { id: null, nombre: 'Descuento manual', origen: 'manual' },
      };
    } else {
      for (const p of promociones) {
        if (p.tipo === 'combo' || !aplicaALinea(p, l)) continue;
        const u = precioConDescuentoC(l.baseC, p.modo, p.valor);
        if (u < mejor.unidadC) mejor = { unidadC: u, promo: { id: p.id, nombre: p.nombre, origen: 'promocion' } };
      }
    }
    return { linea: l, manual: Boolean(manual), mejor, libres: l.cantidad, combos: new Map() };
  });

  for (const combo of promociones.filter((p) => p.tipo === 'combo')) {
    const precioC = Math.round(combo.precioCombo * 100);
    for (let i = 0; i < 100; i++) {
      const tomas = tomarPiezas(combo, estado);
      if (!tomas) break;
      const mejorC = tomas.reduce((s, t) => s + t.cantidad * t.e.mejor.unidadC, 0);
      if (precioC >= mejorC) break; // el combo no baja el precio: no se aplica
      const listaC = tomas.reduce((s, t) => s + t.cantidad * t.e.linea.baseC, 0);
      if (listaC <= 0) break;

      let resto = precioC;
      const partes = tomas.map((t, k) => {
        const parte = k === tomas.length - 1 ? resto : Math.round((precioC * t.cantidad * t.e.linea.baseC) / listaC);
        resto -= parte;
        return parte;
      });
      if (partes.some((p, k) => p < tomas[k].cantidad)) break;

      tomas.forEach((t, k) => {
        const c = t.e.combos.get(combo.id) ?? { cantidad: 0, totalC: 0, promo: { id: combo.id, nombre: combo.nombre, origen: 'promocion' } };
        c.cantidad += t.cantidad;
        c.totalC += partes[k];
        t.e.combos.set(combo.id, c);
        t.e.libres -= t.cantidad;
      });
    }
  }

  const salida = {};
  for (const e of estado) {
    const l = e.linea;
    const partes = [...e.combos.values()].map((c) => ({ cantidad: c.cantidad, totalC: c.totalC, promo: c.promo }));
    if (e.libres > 0) partes.push({ cantidad: e.libres, totalC: Math.round(e.mejor.unidadC * e.libres), promo: e.mejor.promo });
    salida[l.clave] = partes.map((p) => {
      const listaC = Math.round(l.baseC * p.cantidad);
      return {
        cantidad: p.cantidad,
        totalC: p.totalC,
        unidadC: Math.round(p.totalC / p.cantidad),
        promo: p.promo,
        descuentoC: p.promo ? Math.max(listaC - p.totalC, 0) : 0,
      };
    });
  }
  return salida;
}

// Pasa las partidas (productos y servicios) por las promociones y el descuento manual.
// LA USAN el servidor (para decidir) y la Caja (para mostrar): una sola fórmula.
// productos: [{ clave, productoId, presentacionId, departamentoId, cantidad, precioLista, precioAplicado, tasa, total, calculada }]
// servicios: [{ clave, servicioId, tipoArticuloId, departamentoId, precioAplicado, tasa, total, calculada }]
// manuales: { [clave]: { porcentaje } }. motivo y autorizoId solo se anotan en las partidas con descuento manual.
// La cantidad en unidad base (cantidadBase) de una línea partida la recalcula el servidor.
export function aplicarPromocionesAPartidas({ productos, servicios, promociones = [], manuales = {}, incluyeIva, motivo = null, autorizoId = null }) {
  if (!promociones.length && !Object.keys(manuales).length) return { productos, servicios, aplicadas: [] };

  const lineas = [
    ...productos.map((p) => ({
      clave: p.clave,
      productoId: p.productoId,
      presentacionId: p.presentacionId,
      servicioId: null,
      tipoArticuloId: null,
      departamentoId: p.departamentoId,
      cantidad: p.cantidad,
      entera: Number.isInteger(p.cantidad),
      baseC: aCentavos(p.precioLista),
      unidadC: aCentavos(p.precioAplicado),
    })),
    ...servicios.map((s) => ({
      clave: s.clave,
      productoId: null,
      presentacionId: null,
      servicioId: s.servicioId,
      tipoArticuloId: s.tipoArticuloId,
      departamentoId: s.departamentoId,
      cantidad: 1,
      entera: true,
      baseC: aCentavos(s.precioAplicado),
      unidadC: aCentavos(s.precioAplicado),
    })),
  ];
  const resultado = aplicarPromociones({ lineas, promociones, manuales });

  const marcar = (parte) => ({
    promocionId: parte.promo?.id ?? null,
    promocionNombre: parte.promo?.nombre ?? null,
    descuento: aMonto(parte.descuentoC),
    descuentoOrigen: parte.promo?.origen ?? null,
    descuentoMotivo: parte.promo?.origen === 'manual' ? motivo : null,
    descuentoAutorizadoPor: parte.promo?.origen === 'manual' ? autorizoId : null,
  });
  const aplicadas = new Map();
  const anotar = (parte) => {
    if (!parte.promo) return;
    const a = aplicadas.get(parte.promo.nombre) ?? { nombre: parte.promo.nombre, origen: parte.promo.origen, descuentoC: 0 };
    a.descuentoC += parte.descuentoC;
    aplicadas.set(parte.promo.nombre, a);
  };

  const productosFinales = productos.flatMap((p) => {
    const partes = resultado[p.clave];
    if (partes.length === 1 && !partes[0].promo) return [p];
    return partes.map((parte) => {
      anotar(parte);
      const calc = calcularPartidaConTotal({ totalC: parte.totalC, tasa: p.tasa, incluyeIva });
      return {
        ...p,
        cantidad: parte.cantidad,
        precioAplicado: aMonto(parte.unidadC),
        total: calc.total,
        base: calc.subtotal,
        iva: calc.iva,
        calculada: calc,
        ...marcar(parte),
      };
    });
  });

  const serviciosFinales = servicios.map((s) => {
    const [parte] = resultado[s.clave];
    if (!parte.promo) return s;
    anotar(parte);
    const calc = calcularPartidaConTotal({ totalC: parte.totalC, tasa: s.tasa, incluyeIva });
    return { ...s, precioAplicado: aMonto(parte.unidadC), total: calc.total, base: calc.subtotal, iva: calc.iva, calculada: calc, ...marcar(parte) };
  });

  return {
    productos: productosFinales,
    servicios: serviciosFinales,
    aplicadas: [...aplicadas.values()].map((a) => ({ nombre: a.nombre, origen: a.origen, descuento: aMonto(a.descuentoC) })),
  };
}

// Suma de lo ahorrado en una lista de partidas (cada una con su "descuento")
export const totalAhorro = (partidas) => aMonto(partidas.reduce((s, p) => s + aCentavos(p.descuento ?? 0), 0));