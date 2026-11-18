export function formatearTelefono(t) {
  const d = String(t ?? '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return d || 'Sin teléfono';
}

// Fecha de hoy como "2026-11-12"
export function hoyISO() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

export function formatearMoneda(valor, moneda = 'MXN') {
  if (valor === null || valor === undefined || valor === '') return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(Number(valor));
}


// "pieza" -> "piezas", "litro" -> "litros", "cartón" -> "cartones"
export function plural(texto) {
  const t = String(texto).toLowerCase();
  if (t.endsWith('ón')) return t.slice(0, -2) + 'ones';
  return /[aeiou]$/.test(t) ? t + 's' : t + 'es';
}


const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-11-13" -> "13 de noviembre" (sin pasar por zonas horarias)
export function formatearFechaLarga(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

// Hora local de la sucursal, no la de la computadora
export function formatearHora(fechaIso, zona) {
  if (!fechaIso) return '';
  return new Intl.DateTimeFormat('es-MX', { timeZone: zona, hour: '2-digit', minute: '2-digit' }).format(new Date(fechaIso));
}


// "13 de noviembre, 10:45 p. m." en la zona de la sucursal
export function formatearFechaHora(fechaIso, zona) {
  if (!fechaIso) return '';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: zona,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fechaIso));
}