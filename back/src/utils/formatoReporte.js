import { ETIQUETA_ESTADO_NOTA, NOMBRES_MES_CUMPLE } from '@plataforma/calculos';

// Los espacios "especiales" que mete Intl se cambian por uno normal
const limpio = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ');

// Formato en español para los reportes. La hora siempre es la de la sucursal, nunca la del servidor.
export function crearFormato(moneda = 'MXN') {
  const nf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda });
  const dinero = (v) => (v === null || v === undefined || v === '' ? '-' : limpio(nf.format(Number(v))));

  const fechaHora = (iso, zona) => {
    if (!iso) return '';
    const partes = new Intl.DateTimeFormat('es-MX', {
      timeZone: zona || 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    const g = (t) => partes.find((p) => p.type === t)?.value;
    return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
  };

  const fechaDia = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  };

  const fechaLarga = (iso) => {
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return `${d} de ${NOMBRES_MES_CUMPLE[m - 1]} de ${a}`;
  };

  const telefono = (t) => {
    const d = String(t ?? '').replace(/\D/g, '');
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d || '-';
  };

  return { dinero, fechaHora, fechaDia, fechaLarga, telefono };
}

// Formato de moneda para las celdas de Excel
export const formatoExcelMoneda = (moneda) =>
  ({ MXN: '"$"#,##0.00', USD: '"$"#,##0.00', EUR: '"€"#,##0.00' })[moneda] ?? `#,##0.00 "${moneda}"`;

// Lo que se ve en una celda de la tabla de notas (la misma lógica que la pantalla)
export function textoCelda(c, f, fmt) {
  const v = f[c.id];
  if (c.tipo === 'dinero') return v === null || v === undefined ? '-' : fmt.dinero(v);
  // Cada columna de fecha muestra SU fecha (antes todas mostraban la de creación)
  if (c.tipo === 'fecha') return v ? fmt.fechaHora(v, f.zonaHoraria) : '-';
  if (c.tipo === 'dia') return v ? fmt.fechaDia(v) : '-';
  if (c.id === 'estado') return ETIQUETA_ESTADO_NOTA[v] ?? v ?? '-';
  if (c.id === 'telefono') return v ? fmt.telefono(v) : '-';
  if (c.id === 'cliente') return v ?? 'Sin cliente';
  return v ?? '-';
}