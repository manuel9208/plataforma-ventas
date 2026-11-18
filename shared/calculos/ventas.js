import { aCentavos, aMonto } from './redondeo.js';
import { calcularPartida, sumarPartidas } from './impuestos.js';

export const FORMAS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

// Solo lo que se pesa o se mide admite decimales
const UNIDADES_CON_DECIMALES = ['ml', 'lt', 'g', 'kg', 'oz'];
export const permiteDecimales = (unidad) => UNIDADES_CON_DECIMALES.includes(unidad);

// Cantidad válida según la unidad base del producto (decimales solo en granel, hasta 3)
export function validarCantidad(cantidad, unidadBase) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (n > 99999) return false;
  if (!permiteDecimales(unidadBase)) return Number.isInteger(n);
  return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;
}

// Precio unitario para una cantidad: el mejor mayoreo que ya aplique, o el normal.
// mayoreo: [{ cantidadMinima, precio }], precioBase: el de la sucursal o el general.
export function precioPorCantidad(precioBase, mayoreo, cantidad) {
  let aplicado = { precio: Number(precioBase), origen: null };
  for (const r of [...(mayoreo ?? [])].sort((a, b) => a.cantidadMinima - b.cantidadMinima)) {
    if (cantidad >= r.cantidadMinima && r.precio < aplicado.precio) aplicado = { precio: Number(r.precio), origen: 'mayoreo' };
  }
  return aplicado;
}

// El siguiente escalón de mayoreo, para avisar "llevando 5 cada uno sale a $125"
export function siguienteMayoreo(mayoreo, cantidad) {
  const proximos = (mayoreo ?? []).filter((r) => r.cantidadMinima > cantidad).sort((a, b) => a.cantidadMinima - b.cantidadMinima);
  return proximos[0] ?? null;
}

// Una línea de venta. El precio ya incluye IVA solo si la empresa lo configuró así.
export function calcularLineaVenta({ precioBase, mayoreo, cantidad, tasa, incluyeIva }) {
  const { precio, origen } = precioPorCantidad(precioBase, mayoreo, cantidad);
  const partida = calcularPartida({ precio, cantidad, tasa, incluyeIva });
  return { precioAplicado: precio, origenPrecio: origen, ...partida };
}

export const totalesVenta = (lineas) => sumarPartidas(lineas);

// Suma de pagos aplicados a la venta (en centavos, sin errores de decimales)
export function resumenPagos(total, pagos) {
  const totalC = aCentavos(total);
  const pagadoC = pagos.reduce((s, p) => s + aCentavos(p.monto), 0);
  return { pagado: aMonto(pagadoC), falta: aMonto(Math.max(totalC - pagadoC, 0)), sobra: aMonto(Math.max(pagadoC - totalC, 0)) };
}

// Valida los pagos y calcula el cambio. Solo el efectivo puede pasarse del monto.
// Cada pago: { forma, monto, recibido?, referencia? }
export function normalizarPagos(total, pagos) {
  if (!pagos.length) throw new Error('Agrega al menos un pago');
  const totalC = aCentavos(total);
  const normales = pagos.map((p) => {
    if (!FORMAS_PAGO.includes(p.forma)) throw new Error('Forma de pago inválida');
    const montoC = aCentavos(p.monto);
    if (montoC <= 0) throw new Error('Cada pago debe ser mayor a cero');
    if (p.forma === 'transferencia' && !String(p.referencia ?? '').trim()) throw new Error('La transferencia necesita referencia');
    const recibidoC = p.forma === 'efectivo' && p.recibido != null ? aCentavos(p.recibido) : montoC;
    if (recibidoC < montoC) throw new Error('El efectivo recibido no cubre el pago');
    return { forma: p.forma, montoC, recibidoC, referencia: String(p.referencia ?? '').trim() || null };
  });

  const sumaC = normales.reduce((s, p) => s + p.montoC, 0);
  if (sumaC !== totalC) throw new Error('Los pagos deben sumar exactamente el total');

  return normales.map((p) => ({
    forma: p.forma,
    monto: aMonto(p.montoC),
    recibido: aMonto(p.recibidoC),
    cambio: aMonto(p.recibidoC - p.montoC),
    referencia: p.referencia,
  }));
}

// Botones rápidos de efectivo: exacto y los billetes que lo cubren
export function sugerenciasEfectivo(total) {
  const exacto = aCentavos(total);
  const billetes = [5000, 10000, 20000, 50000, 100000].filter((b) => b > exacto);
  return [exacto, ...billetes.slice(0, 3)].map(aMonto);
}

export const armarFolio = (prefijo, numero) => `${prefijo}-${String(numero).padStart(6, '0')}`;