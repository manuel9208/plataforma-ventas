import { aCentavos, aMonto } from './redondeo.js';

// pagos: lista de montos (abonos y liquidaciones) ya registrados
export function calcularEstadoPago(total, pagos = []) {
  const totalC = aCentavos(total);
  const pagadoC = pagos.reduce((suma, p) => suma + aCentavos(p), 0);
  const saldoC = Math.max(totalC - pagadoC, 0);

  let estado = 'pendiente';
  if (totalC > 0 && pagadoC >= totalC) estado = 'pagada';
  else if (pagadoC > 0) estado = 'abonada';

  return { estado, pagado: aMonto(pagadoC), saldo: aMonto(saldoC) };
}