import { aCentavos, aMonto } from './redondeo.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
const DIA_MS = 86400000;

// Índice 0 = lunes (ISO 1) … 6 = domingo (ISO 7)
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Ticket promedio: lo vendido entre las notas que siguen vigentes
export const ticketPromedio = (vendido, notas) => (notas > 0 ? aMonto(Math.round(c(vendido) / notas)) : 0);

// Cuántas veces cae cada día de la semana en el periodo (índice 0 = lunes)
export function contarDiasDeSemana(desde, hasta) {
  const cuenta = Array(7).fill(0);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  for (let t = Date.parse(`${desde}T00:00:00Z`), i = 0; t <= fin && i < 400; t += DIA_MS, i++) {
    cuenta[(new Date(t).getUTCDay() + 6) % 7] += 1;
  }
  return cuenta;
}

// filas: [{ dia (1 a 7), notas, vendido }]. "hasta" ya viene recortado a hoy si el periodo sigue en curso.
export function armarDiasSemana(filas, desde, hasta) {
  const veces = contarDiasDeSemana(desde, hasta);
  const dias = DIAS_SEMANA.map((nombre, i) => {
    const f = filas.find((x) => Number(x.dia) === i + 1);
    const vendidoC = c(f?.vendido);
    return {
      dia: i + 1,
      nombre,
      veces: veces[i],
      notas: Number(f?.notas ?? 0),
      vendido: aMonto(vendidoC),
      promedio: veces[i] > 0 ? aMonto(Math.round(vendidoC / veces[i])) : 0,
    };
  });
  const mejor = dias.reduce((m, d) => (d.promedio > (m?.promedio ?? 0) ? d : m), null);
  return { dias, mejor: mejor ? mejor.dia : null };
}

// Antigüedad de lo que se debe. Los rangos viven aquí: pantalla y servidor usan los mismos.
export const RANGOS_COBRANZA = [
  { id: 'reciente', etiqueta: '0 a 7 días', hasta: 7 },
  { id: 'media', etiqueta: '8 a 15 días', hasta: 15 },
  { id: 'atrasada', etiqueta: 'Más de 15 días', hasta: Infinity },
];

// filas: [{ dias, notas, monto }]
export function agruparCobranza(filas) {
  const r = RANGOS_COBRANZA.map((x) => ({ id: x.id, etiqueta: x.etiqueta, notas: 0, montoC: 0 }));
  for (const f of filas) {
    const i = RANGOS_COBRANZA.findIndex((x) => Number(f.dias) <= x.hasta);
    r[i].notas += Number(f.notas);
    r[i].montoC += c(f.monto);
  }
  return r.map(({ montoC, ...x }) => ({ ...x, monto: aMonto(montoC) }));
}