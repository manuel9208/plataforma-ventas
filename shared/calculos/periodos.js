import { esFechaISO } from './fechas.js';

export const TIPOS_PERIODO = ['dia', 'semana', 'mes', 'anio', 'rango'];
export const MAX_DIAS_REPORTE = 366;

const DIA_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const deISO = (iso) => new Date(`${iso}T00:00:00Z`);
const aISO = (f) => `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
const sumar = (iso, dias) => aISO(new Date(deISO(iso).getTime() + dias * DIA_MS));
const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes de 1 a 12

export const diasDelRango = (desde, hasta) => Math.round((deISO(hasta) - deISO(desde)) / DIA_MS) + 1;

// El periodo que abarca una fecha. La semana va de lunes a domingo. "rango" usa las fechas que elija la persona.
export function rangoDePeriodo(tipo, base, personalizado = null) {
  if (!esFechaISO(base)) throw new Error('Fecha inválida');
  const [y, m] = base.split('-').map(Number);
  switch (tipo) {
    case 'dia':
      return { desde: base, hasta: base };
    case 'semana': {
      const lunes = sumar(base, -((deISO(base).getUTCDay() + 6) % 7));
      return { desde: lunes, hasta: sumar(lunes, 6) };
    }
    case 'mes':
      return { desde: `${y}-${pad(m)}-01`, hasta: `${y}-${pad(m)}-${pad(ultimoDia(y, m))}` };
    case 'anio':
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    case 'rango':
      if (!personalizado) throw new Error('Elige las fechas');
      return { desde: personalizado.desde, hasta: personalizado.hasta };
    default:
      throw new Error('Periodo desconocido');
  }
}

// Para las flechas ‹ ›: la fecha base de unos periodos antes o después (pasos negativos = antes)
export function moverPeriodo(tipo, base, pasos, personalizado = null) {
  const [y, m, d] = base.split('-').map(Number);
  switch (tipo) {
    case 'dia':
      return sumar(base, pasos);
    case 'semana':
      return sumar(base, 7 * pasos);
    case 'mes': {
      const total = y * 12 + (m - 1) + pasos;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
      return `${ny}-${pad(nm)}-${pad(Math.min(d, ultimoDia(ny, nm)))}`;
    }
    case 'anio':
      return `${y + pasos}-${pad(m)}-${pad(Math.min(d, ultimoDia(y + pasos, m)))}`;
    case 'rango':
      return personalizado ? sumar(base, diasDelRango(personalizado.desde, personalizado.hasta) * pasos) : base;
    default:
      throw new Error('Periodo desconocido');
  }
}

export function validarRango(desde, hasta) {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return { ok: false, error: 'Fecha inválida' };
  if (hasta < desde) return { ok: false, error: 'La fecha final no puede ser antes de la inicial' };
  if (diasDelRango(desde, hasta) > MAX_DIAS_REPORTE) return { ok: false, error: `El reporte abarca máximo ${MAX_DIAS_REPORTE} días` };
  return { ok: true };
}

const finDeMes = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(ultimoDia(y, m))}`;
};

// Mismas fechas, "n" meses antes (si ese día no existe, el último del mes)
function restarMeses(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, ultimoDia(ny, nm)))}`;
}

// Con qué se compara un periodo. El PRIMERO es la base de la meta de venta.
export function periodosComparables(tipo, desde, hasta) {
  const p = (id, etiqueta, d, h) => ({ id, etiqueta, desde: d, hasta: h });
  switch (tipo) {
    case 'dia':
      return [
        p('semana', 'El mismo día de la semana pasada', sumar(desde, -7), sumar(hasta, -7)),
        p('mes', 'La misma fecha del mes pasado', restarMeses(desde, 1), restarMeses(hasta, 1)),
        p('anio', 'La misma fecha del año pasado', restarMeses(desde, 12), restarMeses(hasta, 12)),
      ];
    case 'semana': {
      // La misma semana (lunes a domingo) que cae un mes y un año antes
      const delMes = rangoDePeriodo('semana', restarMeses(desde, 1));
      const delAnio = rangoDePeriodo('semana', restarMeses(desde, 12));
      return [
        p('semana', 'Semana pasada', sumar(desde, -7), sumar(hasta, -7)),
        p('mes', 'La misma semana del mes pasado', delMes.desde, delMes.hasta),
        p('anio', 'La misma semana del año pasado', delAnio.desde, delAnio.hasta),
      ];
    }
    case 'mes': {
      const mesPasado = restarMeses(desde, 1);
      const anioPasado = restarMeses(desde, 12);
      return [
        p('mes', 'Mes pasado', mesPasado, finDeMes(mesPasado)),
        p('anio', 'Mismo mes del año pasado', anioPasado, finDeMes(anioPasado)),
      ];
    }
    case 'anio':
      return [p('anio', 'Año pasado', restarMeses(desde, 12), restarMeses(hasta, 12))];
    case 'rango': {
      const n = diasDelRango(desde, hasta);
      return [
        p('anterior', 'Periodo anterior', sumar(desde, -n), sumar(hasta, -n)),
        p('anio', 'Mismas fechas del año pasado', restarMeses(desde, 12), restarMeses(hasta, 12)),
      ];
    }
    default:
      throw new Error('Periodo desconocido');
  }
}

// Si el periodo aún no termina, se compara solo hasta el mismo día: cada periodo de comparación se recorta a los días ya transcurridos
export function recortarComparables(comparables, desde, hoy) {
  if (!esFechaISO(hoy) || hoy < desde) return comparables;
  const transcurridos = diasDelRango(desde, hoy);
  return comparables.map((p) => {
    const limite = sumar(p.desde, transcurridos - 1);
    return limite < p.hasta ? { ...p, hasta: limite } : p;
  });
}