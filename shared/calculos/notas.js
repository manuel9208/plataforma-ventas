import { aCentavos, aMonto } from './redondeo.js';
import { normalizarPagos } from './ventas.js';

// Lo mínimo que debe pagarse al crear la nota: los productos completos, más el porcentaje
// de los servicios solo si la empresa lo exige como mínimo.
export function pagoMinimoNota({ totalProductos = 0, totalServicios = 0, porcentaje = 0, esMinimo = false, financiada = false }) {
  const prodC = aCentavos(totalProductos);
  const servC = aCentavos(totalServicios);
  const exigidoC = esMinimo && !financiada ? Math.ceil(Number(((servC * porcentaje) / 100).toFixed(6))) : 0;
  return aMonto(prodC + exigidoC);
}

// Lo que la pantalla propone cobrar al inicio (productos completos + porcentaje de servicios)
export function abonoSugerido({ totalProductos = 0, totalServicios = 0, porcentaje = 0, financiada = false }) {
  const prodC = aCentavos(totalProductos);
  const servC = aCentavos(totalServicios);
  return aMonto(prodC + (financiada ? 0 : Math.ceil(Number(((servC * porcentaje) / 100).toFixed(6)))));
}

// Pagos de una nota con servicios: pueden cubrir menos que el total, pero nunca más,
// y al menos el mínimo. Cada pago se valida con las mismas reglas de siempre.
export function normalizarPagosNota(total, pagos, minimo = 0) {
  const totalC = aCentavos(total);
  const minC = aCentavos(minimo);
  const normales = pagos.map((p) => normalizarPagos(p.monto, [p])[0]);
  const sumaC = normales.reduce((s, p) => s + aCentavos(p.monto), 0);
  if (sumaC > totalC) throw new Error('Los pagos superan el total de la nota');
  if (sumaC < minC) throw new Error(`Debes cobrar al menos $${aMonto(minC).toFixed(2)}`);
  return normales;
}

// Estado de la nota a partir del estado de cada artículo (se calcula, nunca se guarda)
export function estadoDeNota(estados) {
  const vivos = estados.filter((e) => e !== 'cancelado');
  if (!vivos.length) return estados.length ? 'cancelada' : 'entregada';
  if (vivos.every((e) => e === 'entregado')) return 'entregada';
  if (vivos.every((e) => e === 'listo' || e === 'entregado')) return 'lista';
  if (vivos.some((e) => e !== 'recibido')) return 'en_proceso';
  return 'recibida';
}