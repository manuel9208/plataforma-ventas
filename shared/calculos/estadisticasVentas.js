import { aCentavos, aMonto } from './redondeo.js';
import { DIAS } from './horarios.js';
import { diasDelRango } from './periodos.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
const DIA_MS = 86400000;
const ID_DIA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Si la sucursal no tiene horario, la gráfica usa este
export const HORARIO_POR_DEFECTO = { abre: 9, cierra: 21 };

// Compara lo vendido con lo de otro periodo. "sinBase": el otro periodo no vendió nada.
export function compararVentas(actual, anterior) {
  const a = c(actual);
  const b = c(anterior);
  const diferencia = aMonto(a - b);
  if (b === 0) return { diferencia, porcentaje: null, tendencia: a === 0 ? 'igual' : 'sinBase' };
  return {
    diferencia,
    porcentaje: Math.round(((a - b) / b) * 1000) / 10,
    tendencia: a > b ? 'sube' : a < b ? 'baja' : 'igual',
  };
}

// Meta = lo vendido en el periodo base × (1 + % de crecimiento). Cada sucursal usa su propio %.
// porSucursal: [{ base, porcentaje }] · vendido: lo vendido en el periodo que se revisa
export function metaDeVenta(porSucursal, vendido) {
  const baseC = porSucursal.reduce((s, x) => s + c(x.base), 0);
  const metaC = porSucursal.reduce((s, x) => s + Math.round((c(x.base) * (100 + Number(x.porcentaje))) / 100), 0);
  const vendidoC = c(vendido);
  return {
    base: aMonto(baseC),
    meta: aMonto(metaC),
    vendido: aMonto(vendidoC),
    falta: aMonto(Math.max(metaC - vendidoC, 0)),
    avance: metaC > 0 ? Math.round((vendidoC * 1000) / metaC) / 10 : null,
    cumplida: metaC > 0 && vendidoC >= metaC,
    sinBase: baseC === 0,
  };
}

// Horas (0 a 23) en que atiende al menos una sucursal en algún día del periodo.
// Sin horario configurado (todo "Cerrado") se usa el de por defecto.
// horarios: [{ horario, especiales }] de cada sucursal elegida
export function horasDeAtencion(horarios, desde, hasta) {
  const abiertas = Array(24).fill(false);
  const configurado = horarios.some((h) => h.horario && DIAS.some((d) => h.horario[d.id]?.abierto === true));
  if (!configurado) {
    for (let h = HORARIO_POR_DEFECTO.abre; h < HORARIO_POR_DEFECTO.cierra; h++) abiertas[h] = true;
    return { configurado: false, abiertas };
  }

  const dias = Math.min(diasDelRango(desde, hasta), 366);
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  for (let i = 0; i < dias; i++) {
    const f = new Date(inicio + i * DIA_MS);
    const iso = f.toISOString().slice(0, 10);
    const idDia = ID_DIA[f.getUTCDay()];
    for (const { horario, especiales } of horarios) {
      const especial = (Array.isArray(especiales) ? especiales : []).find((e) => e.fecha === iso);
      const dia = especial
        ? especial.cerrado
          ? { abierto: false }
          : { abierto: true, abre: especial.abre, cierra: especial.cierra, descanso: null }
        : horario?.[idDia];
      if (!dia?.abierto) continue;
      for (let h = Math.floor(minutos(dia.abre) / 60); h < Math.ceil(minutos(dia.cierra) / 60); h++) {
        if (dia.descanso && h * 60 >= minutos(dia.descanso.de) && (h + 1) * 60 <= minutos(dia.descanso.a)) continue;
        abiertas[h] = true;
      }
    }
  }
  return { configurado: true, abiertas };
}

// Une las ventas por hora de este periodo y de sus comparaciones.
// actual: [{ hora, vendido }] · comparables: [{ id, etiqueta, horas: [{ hora, vendido }] }]
// Se muestran las horas abiertas y las que tuvieron ventas, de la primera a la última.
export function armarGraficaHoras({ abiertas, actual, comparables }) {
  const mapa = (filas) => new Map(filas.map((x) => [Number(x.hora), c(x.vendido)]));
  const series = [
    { id: 'actual', etiqueta: 'Este periodo', mapa: mapa(actual) },
    ...comparables.map((x) => ({ id: x.id, etiqueta: x.etiqueta, mapa: mapa(x.horas) })),
  ];
  const nombres = series.map(({ id, etiqueta }) => ({ id, etiqueta }));

  const utiles = [];
  for (let h = 0; h < 24; h++) {
    if (abiertas[h] || series.some((s) => (s.mapa.get(h) ?? 0) > 0)) utiles.push(h);
  }
  if (!utiles.length) return { series: nombres, filas: [], pico: null };

  const filas = [];
  for (let h = utiles[0]; h <= utiles[utiles.length - 1]; h++) {
    const ahora = series[0].mapa.get(h) ?? 0;
    filas.push({
      hora: h,
      abierta: Boolean(abiertas[h]),
      sinVentas: Boolean(abiertas[h]) && ahora === 0,
      valores: Object.fromEntries(series.map((s) => [s.id, aMonto(s.mapa.get(h) ?? 0)])),
    });
  }
  const mejor = filas.reduce((m, f) => (f.valores.actual > (m?.valores.actual ?? 0) ? f : m), null);
  return { series: nombres, filas, pico: mejor ? mejor.hora : null };
}