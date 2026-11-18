// El dinero se calcula en CENTAVOS (enteros) para evitar errores de decimales.
export function aCentavos(monto) {
  const n = Number(monto);
  if (!Number.isFinite(n)) throw new Error('Monto inválido');
  return Math.round((n + Number.EPSILON) * 100);
}

export function aMonto(centavos) {
  return centavos / 100;
}