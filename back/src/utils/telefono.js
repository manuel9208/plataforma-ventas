// Deja solo 10 dígitos. Acepta "(667) 123-4567", "+52 667 123 4567", etc.
export function normalizarTelefono(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d;
}