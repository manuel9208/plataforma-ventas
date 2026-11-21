import { aCentavos, aMonto } from './redondeo.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));

// Puntos que da una cantidad de dinero: cada "monto" pesos dan "puntos" puntos. Siempre hacia abajo.
export function puntosGanados({ base, monto, puntos }) {
  const baseC = c(base);
  const montoC = c(monto);
  const p = Number(puntos);
  if (!(baseC > 0) || !(montoC > 0) || !(p > 0)) return 0;
  return Math.floor(Number(((baseC * p) / montoC).toFixed(6)));
}

// lineas: [{ base, descuento }] · regla: { monto, puntos } · promoDa: ¿una línea con promoción o descuento da puntos?
export function calcularPuntosDeLineas(lineas, regla, { promoDa = true } = {}) {
  const baseC = lineas.reduce((s, l) => (!promoDa && Number(l.descuento ?? 0) > 0 ? s : s + Math.max(c(l.base), 0)), 0);
  const base = aMonto(baseC);
  return { base, puntos: puntosGanados({ base, monto: regla.monto, puntos: regla.puntos }) };
}

export const valorPuntos = (puntos, valor) => aMonto(Math.round(Number(puntos) * c(valor)));

export function sumarMesesISO(iso, meses) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const total = m - 1 + Math.floor(Number(meses));
  const anio = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const p = (x) => String(x).padStart(2, '0');
  return `${anio}-${p(mes + 1)}-${p(Math.min(d, ultimo))}`;
}

// Hasta qué día valen los puntos que se ganan "desde" ese día (null = no caducan)
export function fechaVencimientoPuntos({ caducidad, meses, fecha }, desde) {
  if (caducidad === 'meses' && Number(meses) >= 1) return sumarMesesISO(desde, meses);
  if (caducidad === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ''))) return fecha;
  return null;
}

// ÚNICA fórmula del saldo. movimientos en orden cronológico: [{ puntos, venceEn, fecha }] (fechas "AAAA-MM-DD").
// Lo gastado o devuelto sale primero de los puntos que vencen antes. Los vencidos ya no cuentan.
export function calcularSaldoPuntos(movimientos, hoy) {
  const lotes = [];
  for (const m of movimientos) {
    const p = Math.trunc(Number(m.puntos));
    if (p > 0) {
      lotes.push({ resta: p, venceEn: m.venceEn ?? null });
      continue;
    }
    let falta = -p;
    const disponibles = lotes
      .filter((l) => l.resta > 0 && (!l.venceEn || !m.fecha || l.venceEn >= m.fecha))
      .sort((a, b) => (a.venceEn ?? '9999-99-99').localeCompare(b.venceEn ?? '9999-99-99'));
    for (const l of disponibles) {
      if (!falta) break;
      const t = Math.min(l.resta, falta);
      l.resta -= t;
      falta -= t;
    }
  }
  const vigentes = lotes.filter((l) => l.resta > 0 && (!l.venceEn || l.venceEn >= hoy));
  const suma = (lista) => lista.reduce((s, l) => s + l.resta, 0);
  const conFecha = vigentes.filter((l) => l.venceEn).sort((a, b) => a.venceEn.localeCompare(b.venceEn));
  return {
    saldo: suma(vigentes),
    vencidos: suma(lotes.filter((l) => l.resta > 0 && l.venceEn && l.venceEn < hoy)),
    porVencer: conFecha.length ? { fecha: conFecha[0].venceEn, puntos: suma(conFecha.filter((l) => l.venceEn === conFecha[0].venceEn)) } : null,
  };
}

// Cuántos puntos hay que quitar cuando se devuelve dinero de lo que dio puntos.
// ganados / baseGanada: lo que dio la venta · revertidos / baseDevuelta: lo ya quitado · baseNueva: lo que se devuelve ahora
export function puntosAReversar({ ganados, baseGanada, revertidos = 0, baseDevuelta = 0, baseNueva = 0 }) {
  if (!(ganados > 0) || !(c(baseGanada) > 0)) return 0;
  const vigenteC = Math.max(c(baseGanada) - c(baseDevuelta) - c(baseNueva), 0);
  const objetivo = Math.floor((ganados * vigenteC) / c(baseGanada));
  return Math.max(ganados - revertidos - objetivo, 0);
}