// Horario semanal y días especiales. Funciones puras: el servidor valida, y la portada, los tickets y la IA lo leen igual.
export const DIAS = [
  { id: 'lun', nombre: 'Lunes', corto: 'Lun' },
  { id: 'mar', nombre: 'Martes', corto: 'Mar' },
  { id: 'mie', nombre: 'Miércoles', corto: 'Mié' },
  { id: 'jue', nombre: 'Jueves', corto: 'Jue' },
  { id: 'vie', nombre: 'Viernes', corto: 'Vie' },
  { id: 'sab', nombre: 'Sábado', corto: 'Sáb' },
  { id: 'dom', nombre: 'Domingo', corto: 'Dom' },
];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DIAS_ESPECIALES = 60;
const MAX_NOTA = 80;

export const horarioInicial = () => Object.fromEntries(DIAS.map((d) => [d.id, { abierto: false }]));

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function fechaValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const f = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === s;
}

// Un día: cerrado, o abierto con apertura, cierre y descanso opcional. No cruza la medianoche.
function validarDia(d, nombre) {
  if (!esObjeto(d) || typeof d.abierto !== 'boolean') return { error: `${nombre}: dato inválido` };
  if (!d.abierto) return { dia: { abierto: false } };
  if (!HORA.test(d.abre ?? '') || !HORA.test(d.cierra ?? '')) return { error: `${nombre}: escribe la hora de apertura y de cierre` };
  if (d.abre >= d.cierra) return { error: `${nombre}: el cierre debe ser después de la apertura` };
  let descanso = null;
  if (d.descanso !== null && d.descanso !== undefined) {
    if (!esObjeto(d.descanso) || !HORA.test(d.descanso.de ?? '') || !HORA.test(d.descanso.a ?? '')) {
      return { error: `${nombre}: escribe las horas del descanso` };
    }
    const { de, a } = d.descanso;
    if (!(d.abre < de && de < a && a < d.cierra)) return { error: `${nombre}: el descanso debe quedar dentro del horario` };
    descanso = { de, a };
  }
  return { dia: { abierto: true, abre: d.abre, cierra: d.cierra, descanso } };
}

export function validarHorario(h) {
  if (!esObjeto(h)) return { ok: false, error: 'horario inválido' };
  const valor = {};
  for (const { id, nombre } of DIAS) {
    const r = validarDia(h[id], nombre);
    if (r.error) return { ok: false, error: r.error };
    valor[id] = r.dia;
  }
  return { ok: true, valor };
}

// Días especiales: [{ fecha: 'AAAA-MM-DD', cerrado, abre?, cierra?, nota? }]
export function validarDiasEspeciales(lista) {
  if (!Array.isArray(lista)) return { ok: false, error: 'lista inválida' };
  if (lista.length > MAX_DIAS_ESPECIALES) return { ok: false, error: `máximo ${MAX_DIAS_ESPECIALES} fechas` };
  const vistas = new Set();
  const valor = [];
  for (const x of lista) {
    if (!esObjeto(x) || !fechaValida(x.fecha)) return { ok: false, error: 'hay una fecha inválida' };
    if (vistas.has(x.fecha)) return { ok: false, error: `la fecha ${x.fecha} está repetida` };
    vistas.add(x.fecha);
    const nota = typeof x.nota === 'string' ? x.nota.replace(/\s+/g, ' ').trim() : '';
    if (nota.length > MAX_NOTA) return { ok: false, error: `la nota de ${x.fecha} es muy larga (máximo ${MAX_NOTA})` };
    const r = validarDia({ abierto: x.cerrado !== true, abre: x.abre, cierra: x.cierra }, x.fecha);
    if (r.error) return { ok: false, error: r.error };
    valor.push(r.dia.abierto ? { fecha: x.fecha, cerrado: false, abre: r.dia.abre, cierra: r.dia.cierra, nota } : { fecha: x.fecha, cerrado: true, nota });
  }
  valor.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return { ok: true, valor };
}

const firma = (d) => (d.abierto ? `${d.abre}-${d.cierra}|${d.descanso ? `${d.descanso.de}-${d.descanso.a}` : ''}` : 'cerrado');
const frase = (d) => (d.abierto ? `${d.abre} a ${d.cierra}${d.descanso ? ` (descanso ${d.descanso.de} a ${d.descanso.a})` : ''}` : 'cerrado');

// Líneas listas para mostrar: ["Lun a Vie: 09:00 a 19:00", "Sáb: 09:00 a 14:00", "Dom: cerrado"]
export function textoHorario(h) {
  if (!h) return [];
  const lineas = [];
  let i = 0;
  while (i < DIAS.length) {
    let j = i;
    while (j + 1 < DIAS.length && firma(h[DIAS[j + 1].id]) === firma(h[DIAS[i].id])) j++;
    const rango = i === j ? DIAS[i].corto : j === i + 1 ? `${DIAS[i].corto} y ${DIAS[j].corto}` : `${DIAS[i].corto} a ${DIAS[j].corto}`;
    lineas.push(`${rango}: ${frase(h[DIAS[i].id])}`);
    i = j + 1;
  }
  return lineas;
}

const DIA_INGLES = { Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab', Sun: 'dom' };

function ahoraEn(zona, fecha) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(fecha);
  const g = (t) => partes.find((p) => p.type === t)?.value;
  return { fecha: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}`, dia: DIA_INGLES[g('weekday')] };
}

// true o false según la hora de la sucursal (zona), o null si todavía no hay horario
export function estaAbierto({ horario, especiales = [], zona, ahora = new Date() }) {
  if (!horario) return null;
  const t = ahoraEn(zona, ahora);
  const especial = especiales.find((e) => e.fecha === t.fecha);
  const dia = especial ? (especial.cerrado ? { abierto: false } : { abierto: true, abre: especial.abre, cierra: especial.cierra, descanso: null }) : horario[t.dia];
  if (!dia?.abierto) return false;
  if (t.hora < dia.abre || t.hora >= dia.cierra) return false;
  if (dia.descanso && t.hora >= dia.descanso.de && t.hora < dia.descanso.a) return false;
  return true;
}

// Fecha (AAAA-MM-DD), hora (HH:MM) y día (lun..dom) en la zona dada. Lo usan las promociones.
export const fechaHoraEnZona = (zona, fecha = new Date()) => ahoraEn(zona, fecha);