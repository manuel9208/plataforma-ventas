import { aCentavos, aMonto } from './redondeo.js';

export const CATEGORIAS_GASTO = ['proveedor', 'insumos', 'servicios', 'otro'];

export const ETIQUETA_CATEGORIA = {
  proveedor: 'Pago a proveedor',
  insumos: 'Compra de insumos',
  servicios: 'Servicios (luz, agua…)',
  otro: 'Otro gasto',
};

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));

// Cuánto efectivo debe haber en la caja y cómo se movió el dinero. Todo en centavos para no arrastrar decimales.
export function calcularCorte(d) {
  const efectivoC = c(d.cobrosEfectivo) - c(d.reembolsosEfectivo);
  const tarjetaC = c(d.cobrosTarjeta) - c(d.reembolsosTarjeta);
  const transferenciaC = c(d.cobrosTransferencia) - c(d.reembolsosTransferencia);
  const esperadoC = c(d.fondo) + efectivoC - c(d.gastos) - c(d.retiros);
  return {
    fondo: aMonto(c(d.fondo)),
    cobrosEfectivo: aMonto(c(d.cobrosEfectivo)),
    cobrosTarjeta: aMonto(c(d.cobrosTarjeta)),
    cobrosTransferencia: aMonto(c(d.cobrosTransferencia)),
    reembolsosEfectivo: aMonto(c(d.reembolsosEfectivo)),
    reembolsosTarjeta: aMonto(c(d.reembolsosTarjeta)),
    reembolsosTransferencia: aMonto(c(d.reembolsosTransferencia)),
    gastos: aMonto(c(d.gastos)),
    retiros: aMonto(c(d.retiros)),
    efectivoNeto: aMonto(efectivoC),
    tarjetaNeta: aMonto(tarjetaC),
    transferenciaNeta: aMonto(transferenciaC),
    ventaNeta: aMonto(efectivoC + tarjetaC + transferenciaC),
    esperado: aMonto(esperadoC),
  };
}

// Lo que declara quien hace el corte: lo contado y lo que deja para mañana. Devuelve lo que se entrega a los dueños.
export function validarConteo({ contado, dejado }) {
  const contadoC = c(contado);
  const dejadoC = c(dejado);
  if (contadoC < 0 || dejadoC < 0) throw new Error('Los montos no pueden ser negativos');
  if (dejadoC > contadoC) throw new Error('No puedes dejar más efectivo del que contaste');
  return { contado: aMonto(contadoC), dejado: aMonto(dejadoC), entregado: aMonto(contadoC - dejadoC) };
}

// Compara lo contado con lo esperado: cuadra, sobra o falta
export function evaluarConteo({ esperado, contado }) {
  const difC = c(contado) - c(esperado);
  return { diferencia: aMonto(difC), resultado: difC === 0 ? 'cuadra' : difC > 0 ? 'sobra' : 'falta' };
}

// Aviso de retiro por seguridad: efectivo de las ventas que se junta en la caja (sin contar el fondo inicial)
export function efectivoPorRetirar({ cobrosEfectivo = 0, reembolsosEfectivo = 0, gastos = 0, retiros = 0, limite = 0 }) {
  const acumuladoC = Math.max(c(cobrosEfectivo) - c(reembolsosEfectivo) - c(gastos) - c(retiros), 0);
  const limiteC = c(limite);
  const debeRetirar = limiteC > 0 && acumuladoC >= limiteC;
  return {
    limite: aMonto(limiteC),
    acumulado: aMonto(acumuladoC),
    debeRetirar,
    retirar: debeRetirar ? aMonto(acumuladoC) : 0,
  };
}