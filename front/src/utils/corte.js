// Cómo se ve el resultado de un corte: cuadra, sobra, falta o sin conteo
export const RESULTADO_CORTE = {
  cuadra: { titulo: 'Cuadra', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  sobra: { titulo: 'Sobra', clases: 'bg-amber-50 text-amber-800 border-amber-200' },
  falta: { titulo: 'Falta', clases: 'bg-red-50 text-red-800 border-red-200' },
  sin_conteo: { titulo: 'Sin conteo', clases: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

export function textoDiferencia(resultado, diferencia, dinero) {
  if (resultado === 'sin_conteo') return 'Cerrado sin conteo de efectivo';
  if (resultado === 'cuadra') return 'Cuadra: no sobra ni falta nada';
  const monto = dinero(Math.abs(diferencia));
  return resultado === 'sobra' ? `Sobran ${monto}` : `Faltan ${monto}`;
}