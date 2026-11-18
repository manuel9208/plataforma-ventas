import { aCentavos, aMonto } from './redondeo.js';
import { permiteDecimales } from './ventas.js';
import { planCancelacion } from './saldo.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
// Las cantidades llevan hasta 3 decimales: se comparan en milésimas para no arrastrar errores
const mil = (v) => Math.round(Number(v ?? 0) * 1000);

// Cuánto queda por devolver de una partida (en su misma unidad)
export const cantidadDisponible = (p) => (mil(p.cantidad) - mil(p.cantidadDevuelta)) / 1000;

// Valor de devolver "cantidad" de una partida. Lo último que queda por devolver se lleva el centavo sobrante.
export function valorDevolucion(p, cantidad) {
  const queda = mil(p.cantidad) - mil(p.cantidadDevuelta);
  const quiere = mil(cantidad);
  if (!(quiere > 0)) throw new Error('La cantidad a devolver debe ser mayor a cero');
  if (Math.abs(Number(cantidad) * 1000 - quiere) > 1e-6) throw new Error('La cantidad admite máximo 3 decimales');
  if (!permiteDecimales(p.unidad) && quiere % 1000 !== 0) throw new Error(`${p.nombre} solo se devuelve en cantidades enteras`);
  if (quiere > queda) {
    throw new Error(queda > 0 ? `De ${p.nombre} solo quedan ${queda / 1000} por devolver` : `${p.nombre} ya se devolvió completo`);
  }
  const restanteC = c(p.total) - c(p.valorDevuelto);
  if (quiere === queda) return aMonto(restanteC);
  const parteC = Math.round((c(p.total) * quiere) / mil(p.cantidad));
  return aMonto(Math.min(parteC, restanteC));
}

// Devolución de productos de una venta de mostrador. lineas: [{ partidaId, cantidad }].
// Se regresa todo lo pagado por lo devuelto (no hay dinero retenido).
export function planDevolucionVenta(datosNota, partidas, lineas) {
  if (!lineas?.length) throw new Error('Elige qué se devuelve');
  if (new Set(lineas.map((l) => l.partidaId)).size !== lineas.length) throw new Error('Hay productos repetidos');

  const porId = new Map(partidas.map((p) => [p.id, p]));
  const detalle = lineas.map((l) => {
    const p = porId.get(l.partidaId);
    if (!p || p.tipo !== 'producto') throw new Error('Hay un producto que no pertenece a esta venta');
    if (p.ajusteId) throw new Error(`${p.nombre} ya se devolvió`);
    return { partidaId: p.id, nombre: p.nombre, unidad: p.unidad, cantidad: Number(l.cantidad), valor: valorDevolucion(p, l.cantidad) };
  });

  const productos = aMonto(detalle.reduce((s, l) => s + c(l.valor), 0));
  const maximo = planCancelacion(datosNota, { productos, servicios: 0 }, 0);
  const plan = planCancelacion(datosNota, { productos, servicios: 0 }, maximo.tope);
  return { lineas: detalle, ...plan };
}