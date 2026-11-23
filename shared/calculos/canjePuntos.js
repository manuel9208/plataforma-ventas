import { aCentavos, aMonto } from './redondeo.js';
import { valorPuntos } from './puntos.js';
import { calcularPartidaConTotal } from './descuentos.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
const piezasDe = (l) => Math.max(Math.ceil(Number(l.piezas ?? 1)), 1);
const falla = (error) => ({ ok: false, error });

// ¿Esta partida admite canje? tipo: 'producto' | 'servicio'. descuento: lo que ya trae de promoción o descuento manual.
// ajustes: { canjearProductos, canjearServicios, enPromo }
export function lineaAdmiteCanje({ tipo, descuento = 0 }, ajustes) {
  if (tipo === 'servicio' ? !ajustes.canjearServicios : !ajustes.canjearProductos) return false;
  return !(Number(descuento) > 0) || ajustes.enPromo === true;
}

// Puntos enteros que cada partida puede absorber: nunca queda por debajo de 1 centavo por pieza
function topesPorLinea(lineas, valor) {
  const v = c(valor);
  return lineas.map((l) => {
    const totalC = Math.max(c(l.total), 0);
    return { clave: l.clave, totalC, tope: v > 0 ? Math.max(Math.floor((totalC - piezasDe(l)) / v), 0) : 0, puntos: 0 };
  });
}

// lineas: solo las que admiten canje, [{ clave, total, piezas }] (total sin cargo de financiamiento ni extras)
export function limiteCanje({ saldo, valor, topePct, minimo = 0, lineas }) {
  const v = c(valor);
  const items = topesPorLinea(lineas, valor);
  const baseC = items.reduce((s, i) => s + i.totalC, 0);
  const minPuntos = Math.max(1, Math.ceil(Number(minimo) || 0));
  const porTope = v > 0 ? Math.floor(Number(((baseC * Number(topePct || 0)) / 100 / v).toFixed(6))) : 0;
  const porLineas = items.reduce((s, i) => s + i.tope, 0);
  const maxPuntos = Math.max(Math.min(Math.trunc(Number(saldo) || 0), porTope, porLineas), 0);
  return { minPuntos, maxPuntos, puedeCanjear: maxPuntos >= minPuntos, base: aMonto(baseC) };
}

// Reparte puntos enteros entre las partidas en proporción a su importe (el sobrante, a quien tiene el mayor residuo).
export function repartirCanje({ lineas, puntos, valor }) {
  const items = topesPorLinea(lineas, valor);
  let resto = Math.trunc(Number(puntos));
  while (resto > 0) {
    const libres = items.filter((i) => i.puntos < i.tope);
    if (!libres.length) break;
    const suma = libres.reduce((s, i) => s + i.totalC, 0);
    const cuotas = libres.map((i) => ({ i, base: Math.floor((resto * i.totalC) / suma), residuo: (resto * i.totalC) % suma }));
    let dado = 0;
    for (const q of cuotas) {
      const n = Math.min(q.base, q.i.tope - q.i.puntos);
      q.i.puntos += n;
      dado += n;
    }
    for (const q of [...cuotas].sort((a, b) => b.residuo - a.residuo)) {
      if (dado >= resto) break;
      if (q.i.puntos < q.i.tope) {
        q.i.puntos += 1;
        dado += 1;
      }
    }
    if (dado === 0) break;
    resto -= dado;
  }
  return {
    sinRepartir: resto,
    lineas: items.filter((i) => i.puntos > 0).map((i) => ({ clave: i.clave, puntos: i.puntos, descuento: valorPuntos(i.puntos, valor) })),
  };
}

// LA usan el servidor (decide) y la Caja (muestra). Devuelve { ok: true, puntos, descuento, lineas } o { ok: false, error }
export function calcularCanje({ puntos, saldo, valor, topePct, minimo, lineas }) {
  const l = limiteCanje({ saldo, valor, topePct, minimo, lineas });
  if (!Number.isInteger(puntos) || puntos < 1) return falla('Escribe cuántos puntos usar (números enteros)');
  if (Math.trunc(Number(saldo) || 0) < l.minPuntos) return falla(`Se necesitan al menos ${l.minPuntos} puntos para canjear`);
  if (!l.puedeCanjear) return falla('En esta compra no se pueden usar puntos');
  if (puntos < l.minPuntos) return falla(`El mínimo para canjear es de ${l.minPuntos} puntos`);
  if (puntos > Math.trunc(saldo)) return falla(`El cliente solo tiene ${Math.trunc(saldo)} puntos`);
  if (puntos > l.maxPuntos) return falla(`En esta compra se pueden usar hasta ${l.maxPuntos} puntos`);
  const r = repartirCanje({ lineas, puntos, valor });
  if (r.sinRepartir > 0) return falla('No se pudieron repartir los puntos en esta compra');
  return { ok: true, puntos, descuento: valorPuntos(puntos, valor), lineas: r.lineas };
}

// partidas ya con promociones. Claves únicas por posición: p0, p1… (productos) y s0, s1… (servicios).
// Si no se permite canje en notas con promoción y la nota trae CUALQUIER descuento, ninguna línea admite canje.
// En servicios cuenta solo el servicio (sin extras ni cargo de financiamiento).
export function elegirLineasCanje({ productos, servicios, ajustes }) {
  const todas = [
    ...productos.map((p, i) => ({ clave: `p${i}`, tipo: 'producto', total: p.calculada.total, piezas: Math.ceil(Number(p.cantidad)), descuento: p.descuento })),
    ...servicios.map((s, i) => ({ clave: `s${i}`, tipo: 'servicio', total: s.calculada.total, piezas: 1, descuento: s.descuento })),
  ];
  if (todas.some((l) => Number(l.descuento ?? 0) > 0) && ajustes.enPromo !== true) return [];
  return todas.filter((l) => lineaAdmiteCanje({ tipo: l.tipo, descuento: 0 }, ajustes));
}

// Puntos que se devuelven al cancelar: los usados en lo cancelado, menos la parte proporcional a lo que la tienda retiene
export function puntosADevolverCancelacion({ puntosUsados, cancelado, retenido }) {
  const p = Math.trunc(Number(puntosUsados) || 0);
  if (p <= 0) return 0;
  const canC = c(cancelado);
  const retC = Math.min(Math.max(c(retenido), 0), canC);
  if (canC <= 0 || retC <= 0) return p;
  return p - Math.floor((p * retC) / canC);
}

// Devolución de una parte de un renglón: puntos que tocan por lo que se devuelve AHORA.
// Cuenta acumulada (antes y después), así la suma de varias devoluciones da exacto los puntos usados.
export function puntosADevolverRenglon({ puntosUsados, total, devueltoAntes = 0, devueltoAhora = 0 }) {
  const p = Math.trunc(Number(puntosUsados) || 0);
  const t = c(total);
  if (p <= 0 || t <= 0) return 0;
  const antes = Math.min(c(devueltoAntes), t);
  const despues = Math.min(antes + c(devueltoAhora), t);
  const hasta = (x) => Math.floor((p * x) / t);
  return hasta(despues) - hasta(antes);
}

// ajustes: { valor, topePct, minimo, canjearProductos, canjearServicios, enPromo }
// Cuántos puntos se pueden usar en esta compra (productos y servicios ya con sus promociones)
export function limiteCanjeDeVenta({ productos, servicios, ajustes, saldo }) {
  const lineas = elegirLineasCanje({ productos, servicios, ajustes });
  return limiteCanje({ saldo, valor: ajustes.valor, topePct: ajustes.topePct, minimo: ajustes.minimo, lineas });
}

// LA usan el servidor (decide) y la Caja (muestra). Rebaja las partidas con el reparto de puntos.
// Devuelve { ok: false, error } o { ok: true, puntos, descuento, productos, servicios }
export function resolverCanje({ productos, servicios, ajustes, saldo, puntos, incluyeIva }) {
  const lineas = elegirLineasCanje({ productos, servicios, ajustes });
  const r = calcularCanje({ puntos, saldo, valor: ajustes.valor, topePct: ajustes.topePct, minimo: ajustes.minimo, lineas });
  if (!r.ok) return r;

  const porClave = new Map(r.lineas.map((l) => [l.clave, l]));
  const rebajar = (partida, l) => {
    if (!l) return partida;
    const calc = calcularPartidaConTotal({ totalC: c(partida.calculada.total) - c(l.descuento), tasa: partida.tasa, incluyeIva });
    return { ...partida, total: calc.total, base: calc.subtotal, iva: calc.iva, calculada: calc, puntosCanjeados: l.puntos, descuentoPuntos: l.descuento };
  };
  return {
    ok: true,
    puntos: r.puntos,
    descuento: r.descuento,
    productos: productos.map((p, i) => rebajar(p, porClave.get(`p${i}`))),
    servicios: servicios.map((s, i) => rebajar(s, porClave.get(`s${i}`))),
  };
}