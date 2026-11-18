import { aUnidadBase, aplicarPromocionesAPartidas, promocionVigente } from '@plataforma/calculos';
import { ErrorHttp } from '../utils/errores.js';
import { moduloActivo } from '../utils/modulos.js';
import * as repo from '../repositories/promociones.repository.js';

function armarManuales({ descuentos, productos, servicios, config }) {
  const manuales = {};
  if (!descuentos) return manuales;
  const max = config.descuentoManualMax;
  if (!(max > 0)) throw new ErrorHttp(409, 'Esta sucursal no permite descuentos manuales.');
  const claves = new Set([...productos.map((p) => p.clave), ...servicios.map((s) => s.clave)]);
  for (const l of descuentos.lineas) {
    const clave = l.presentacionId != null ? `p${l.presentacionId}` : `s${l.servicioIndice}`;
    if (!claves.has(clave)) throw new ErrorHttp(400, 'El descuento es de un artículo que no está en la venta.');
    if (l.porcentaje > max) throw new ErrorHttp(400, `El descuento máximo permitido es ${max}%.`);
    manuales[clave] = { porcentaje: l.porcentaje };
  }
  return manuales;
}

// Recibe los productos y servicios ya armados y devuelve los definitivos, con promociones y descuento manual.
// c: { empresaId, sucursalId, zona, productos, servicios, descuentos, config, incluyeIva, autorizoId }
export async function aplicarPromocionesVenta(db, c) {
  const activo = await moduloActivo(c.empresaId, 'promociones');
  const manuales = activo ? armarManuales(c) : {};
  const promociones = activo
    ? (await repo.cargarParaVenta(db, c.empresaId, c.sucursalId)).filter((p) => promocionVigente(p, { zona: c.zona }))
    : [];

  const r = aplicarPromocionesAPartidas({
    productos: c.productos,
    servicios: c.servicios,
    promociones,
    manuales,
    incluyeIva: c.incluyeIva,
    motivo: c.descuentos?.motivo ?? null,
    autorizoId: c.autorizoId,
  });
  // Una línea partida por un combo cambia de cantidad: se recalcula su cantidad en unidad base
  return { ...r, productos: r.productos.map((p) => ({ ...p, cantidadBase: aUnidadBase(p.cantidad, p.factor) })) };
}