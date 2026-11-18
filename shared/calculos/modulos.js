import { aCentavos, aMonto } from './redondeo.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));

// Un módulo con fecha de vencimiento vencida cuenta como apagado. hoy y venceEn: "2026-11-30".
export const moduloVigente = (venceEn, hoy) => !venceEn || String(venceEn).slice(0, 10) >= hoy;

// Precio de un módulo para una empresa: el suyo si lo tiene, si no el sugerido
export const precioDeModulo = ({ precioPropio, precioSugerido }) => Number(precioPropio ?? precioSugerido ?? 0);

// Cuánto cuesta un módulo al mes. Por sucursal: el precio se multiplica por las sucursales activas.
export function costoModulo({ cobro, precio, sucursales }) {
  const veces = cobro === 'sucursal' ? Math.max(Number(sucursales) || 0, 0) : 1;
  return aMonto(c(precio) * veces);
}

// Total mensual de una empresa: solo cuentan los módulos encendidos y vigentes
export function totalMensual(modulos, sucursales, hoy) {
  const totalC = modulos
    .filter((m) => m.activo && moduloVigente(m.venceEn, hoy))
    .reduce((s, m) => s + c(costoModulo({ cobro: m.cobro, precio: precioDeModulo(m), sucursales })), 0);
  return aMonto(totalC);
}