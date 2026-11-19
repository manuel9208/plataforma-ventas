import { aCentavos, aMonto } from './redondeo.js';
import { desglosarIva } from './impuestos.js';
import { permiteDecimales } from './ventas.js';

const num = (v) => Number(v);

// Las promociones que agrupan piezas (combo y "lleva y paga") compiten por las piezas libres
const PAQUETES = ['combo', 'lleva_paga'];
const MAX_GRUPOS = 100; // grupos por promoción en una misma venta

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

// Cada candidato es el siguiente grupo que una promoción de paquete podría formar:
// { promo, ahorroC, tomas: [{ e, cantidad, totalC }] }. ahorroC = cuánto baja frente a lo que ya costaban esas piezas.
function candidatoCombo(combo, estado) {
  const precioC = Math.round(combo.precioCombo * 100);
  const tomas = tomarPiezas(combo, estado);
  if (!tomas) return null;
  const mejorC = tomas.reduce((s, t) => s + t.cantidad * t.e.mejor.unidadC, 0);
  if (precioC >= mejorC) return null; // el combo no baja el precio: no se aplica
  const listaC = tomas.reduce((s, t) => s + t.cantidad * t.e.linea.baseC, 0);
  if (listaC <= 0) return null;

  let resto = precioC;
  const partes = tomas.map((t, k) => {
    const parte = k === tomas.length - 1 ? resto : Math.round((precioC * t.cantidad * t.e.linea.baseC) / listaC);
    resto -= parte;
    return parte;
  });
  if (partes.some((p, k) => p < tomas[k].cantidad)) return null;

  return { promo: combo, ahorroC: mejorC - precioC, tomas: tomas.map((t, k) => ({ e: t.e, cantidad: t.cantidad, totalC: partes[k] })) };
}

// Lleva N, paga M. Las piezas libres que cubre la promoción se ordenan de la más cara a la más barata y se agrupan de N en N.
// En el grupo pagan completas las M más caras; si M trae decimal, la siguiente paga esa fracción y el resto va casi gratis.
// "Casi": cada pieza cuesta mínimo 1 centavo (piso del sistema); esos centavos se descuentan de la pieza que más paga,
// para que el grupo cueste exactamente lo prometido. Se calcula desde el precio de lista.
function candidatoLlevaPaga(promo, estado) {
  const pagaC = Math.round(promo.paga * 100);
  const enteras = Math.floor(pagaC / 100);
  const fraccion = pagaC % 100;

  const elegibles = estado
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.manual && e.linea.contable === true && e.libres > 0 && e.linea.baseC > 0 && aplicaALinea(promo, e.linea))
    .sort((a, b) => b.e.linea.baseC - a.e.linea.baseC || a.i - b.i);

  const piezas = [];
  for (const { e } of elegibles) {
    for (let n = 0; n < e.libres && piezas.length < promo.lleva; n++) piezas.push(e);
    if (piezas.length === promo.lleva) break;
  }
  if (piezas.length < promo.lleva) return null;

  const pagos = piezas.map((e, k) => {
    if (k < enteras) return e.linea.baseC;
    return k === enteras ? Math.round((e.linea.baseC * fraccion) / 100) : 0;
  });

  let faltanteC = 0;
  const finales = pagos.map((c) => {
    if (c >= 1) return c;
    faltanteC += 1 - c;
    return 1;
  });
  const mayor = finales.indexOf(Math.max(...finales));
  if (finales[mayor] - faltanteC < 1) return null;
  finales[mayor] -= faltanteC;

  const totalC = finales.reduce((s, c) => s + c, 0);
  const actualC = piezas.reduce((s, e) => s + e.mejor.unidadC, 0);
  if (totalC >= actualC) return null; // no ahorra más que lo que ya tenía

  const porLinea = new Map();
  piezas.forEach((e, k) => {
    const t = porLinea.get(e) ?? { e, cantidad: 0, totalC: 0 };
    t.cantidad += 1;
    t.totalC += finales[k];
    porLinea.set(e, t);
  });
  return { promo, ahorroC: actualC - totalC, tomas: [...porLinea.values()] };
}

function aplicarCandidato(c) {
  const origen = { id: c.promo.id, nombre: c.promo.nombre, origen: 'promocion' };
  for (const t of c.tomas) {
    const acum = t.e.combos.get(c.promo.id) ?? { cantidad: 0, totalC: 0, promo: origen };
    acum.cantidad += t.cantidad;
    acum.totalC += t.totalC;
    t.e.combos.set(c.promo.id, acum);
    t.e.libres -= t.cantidad;
  }
}

// lineas: [{ clave, productoId, presentacionId, servicioId, tipoArticuloId, departamentoId, cantidad, entera, contable,
//            baseC (precio de lista por pieza, sin mayoreo), unidadC (precio actual por pieza, con mayoreo) }]
// contable: cada pieza cuenta como una unidad para "lleva y paga" (servicios y piezas enteras; nunca el granel).
// promociones: las vigentes. manuales: { [clave]: { porcentaje } }.
// Devuelve { [clave]: [{ cantidad, totalC, unidadC, descuentoC, promo }] }. Una línea se parte si una parte entra a un paquete.
// Entre combos y "lleva y paga" que compiten por las mismas piezas gana el que más ahorra (en empate, el creado primero).
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
        if (PAQUETES.includes(p.tipo) || !aplicaALinea(p, l)) continue;
        const u = precioConDescuentoC(l.baseC, p.modo, p.valor);
        if (u < mejor.unidadC) mejor = { unidadC: u, promo: { id: p.id, nombre: p.nombre, origen: 'promocion' } };
      }
    }
    return { linea: l, manual: Boolean(manual), mejor, libres: l.cantidad, combos: new Map() };
  });

  const ofertas = promociones.filter((p) => PAQUETES.includes(p.tipo));
  const grupos = new Map();
  for (let vuelta = 0; vuelta < MAX_GRUPOS * Math.max(ofertas.length, 1); vuelta++) {
    let elegido = null;
    for (const p of ofertas) {
      if ((grupos.get(p.id) ?? 0) >= MAX_GRUPOS) continue;
      const c = p.tipo === 'combo' ? candidatoCombo(p, estado) : candidatoLlevaPaga(p, estado);
      if (c && (!elegido || c.ahorroC > elegido.ahorroC)) elegido = c;
    }
    if (!elegido) break;
    aplicarCandidato(elegido);
    grupos.set(elegido.promo.id, (grupos.get(elegido.promo.id) ?? 0) + 1);
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
// productos: [{ clave, productoId, presentacionId, departamentoId, unidad, cantidad, precioLista, precioAplicado, tasa, total, calculada }]
// servicios: [{ clave, servicioId, tipoArticuloId, departamentoId, precioAplicado, tasa, total, calculada }]
// "unidad" de cada producto es obligatoria para "lleva y paga": sin ella el producto no entra (así el granel nunca se cuela).
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
      contable: Number.isInteger(p.cantidad) && p.unidad != null && !permiteDecimales(p.unidad),
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
      contable: true,
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