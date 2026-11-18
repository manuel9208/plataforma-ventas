const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'di']);

// "juan manuel jacobo prieto" -> "Juan Manuel Jacobo Prieto" ("de", "del"… quedan en minúscula)
export function nombrePropio(texto) {
  return String(texto)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}