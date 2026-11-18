import { aCentavos, aMonto } from './redondeo.js';

// La tasa llega como porcentaje (16 = 16%). Se trabaja en puntos base para evitar decimales.
const puntosBase = (tasa) => {
  const t = Number(tasa);
  if (!Number.isFinite(t) || t < 0) throw new Error('Tasa de IVA inválida');
  return Math.round(t * 100);
};

// Saca el IVA de un precio que ya lo incluye. Siempre: base + iva = total.
export function desglosarIva(precioConIva, tasa) {
  const totalC = aCentavos(precioConIva);
  const baseC = Math.round((totalC * 10000) / (10000 + puntosBase(tasa)));
  return { base: aMonto(baseC), iva: aMonto(totalC - baseC), total: aMonto(totalC) };
}

// Una partida de venta. Si los precios no incluyen IVA solo se muestra el total.
export function calcularPartida({ precio, cantidad = 1, tasa = 0, incluyeIva }) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Cantidad inválida');
  const totalC = Math.round(aCentavos(precio) * n);
  const total = aMonto(totalC);
  if (!incluyeIva) return { total, subtotal: null, iva: null, desglosado: false };
  const { base, iva } = desglosarIva(total, tasa);
  return { total, subtotal: base, iva, desglosado: true };
}

// Suma de partidas, en centavos para no arrastrar errores de decimales.
export function sumarPartidas(partidas) {
  let totalC = 0;
  let baseC = 0;
  let ivaC = 0;
  let desglosado = partidas.length > 0;
  for (const p of partidas) {
    totalC += aCentavos(p.total);
    if (p.desglosado) {
      baseC += aCentavos(p.subtotal);
      ivaC += aCentavos(p.iva);
    } else {
      desglosado = false;
    }
  }
  return desglosado
    ? { total: aMonto(totalC), subtotal: aMonto(baseC), iva: aMonto(ivaC), desglosado: true }
    : { total: aMonto(totalC), subtotal: null, iva: null, desglosado: false };
}