import { aCentavos, aMonto } from './redondeo.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
const proporcion = (parteC, numC, denC) => (denC > 0 ? Number((BigInt(parteC) * BigInt(numC)) / BigInt(denC)) : 0);
const pesos = (centavos) => `$${aMonto(centavos).toFixed(2)}`;

// ÚNICA fórmula del saldo de una nota. La lista usa la misma cuenta escrita en SQL (SALDO_SQL).
export function resumenNota({ total = 0, cancelado = 0, ajustado = 0, retenido = 0, reembolsado = 0, cobrado = 0 }) {
  const vigenteC = Math.max(c(total) - c(cancelado) - c(ajustado), 0);
  const valorC = vigenteC + c(retenido);
  const netoC = Math.max(c(cobrado) - c(reembolsado), 0);
  const saldoC = Math.max(valorC - netoC, 0);
  return {
    totalOriginal: aMonto(c(total)),
    total: aMonto(valorC), // lo que vale la nota ahora
    pagado: aMonto(netoC), // lo cobrado menos lo devuelto
    saldo: aMonto(saldoC),
    estadoPago: saldoC === 0 ? 'pagada' : netoC > 0 ? 'abonada' : 'pendiente',
    hayAjustes: c(cancelado) + c(ajustado) + c(retenido) + c(reembolsado) > 0,
  };
}

// A qué se aplicó el dinero cobrado: primero a los productos, el resto a los servicios.
// valores en pesos: productosVigentes, serviciosVigentes (con extras) y serviciosHechos (Listos o Entregados).
export function repartoPagado(d) {
  const netoC = Math.max(c(d.cobrado) - c(d.reembolsado), 0);
  const pvC = c(d.productosVigentes);
  const efC = Math.max(c(d.serviciosVigentes) - c(d.ajustado), 0);
  const hechosEfC = Math.min(Math.max(c(d.serviciosHechos) - c(d.ajustado), 0), efC);
  const payProdC = Math.min(netoC, pvC);
  const payServC = Math.min(Math.max(netoC - pvC - c(d.retenido), 0), efC);
  return { netoC, efC, payProdC, payServC, payHechosC: proporcion(payServC, hechosEfC, efC) };
}

// Cancelar productos (se devuelven) y/o servicios en espera. "cancela" = valor de lo que se cancela, en pesos.
// devolver = lo que el encargado decide regresar; el resto del tope queda retenido.
export function planCancelacion(datos, { productos = 0, servicios = 0 }, devolver = 0) {
  const r = repartoPagado(datos);
  const cpC = c(productos);
  const csC = c(servicios);
  if (cpC + csC <= 0) throw new Error('No hay nada que cancelar');
  if (cpC > c(datos.productosVigentes)) throw new Error('Alguno de los productos elegidos ya no está vigente');
  if (csC > r.efC) throw new Error('Esta nota ya tiene un reembolso sobre esos trabajos, no se pueden cancelar');

  const topeC = Math.min(cpC, r.payProdC) + proporcion(r.payServC, csC, r.efC);
  const devC = c(devolver);
  if (devC < 0) throw new Error('El monto a devolver no es válido');
  if (devC > topeC) throw new Error(`Solo se puede devolver hasta ${pesos(topeC)}`);
  return {
    cancelado: aMonto(cpC + csC),
    tope: aMonto(topeC),
    devuelto: aMonto(devC),
    retenido: aMonto(topeC - devC),
  };
}

// Reembolso suelto: dinero que se regresa sin quitar el trabajo (Listo o Entregado). No cambia el saldo.
export function planReembolso(datos, monto) {
  const r = repartoPagado(datos);
  if (c(datos.serviciosHechos) <= 0) {
    throw new Error('Esta nota no tiene trabajos Listos ni Entregados. Para devolver dinero, cancélala.');
  }
  const mC = c(monto);
  if (mC <= 0) throw new Error('El monto debe ser mayor a cero');
  if (mC > r.payHechosC) throw new Error(`Solo se puede reembolsar hasta ${pesos(r.payHechosC)}`);
  return { monto: aMonto(mC), tope: aMonto(r.payHechosC) };
}