import {
  aCentavos,
  aMonto,
  calcularPuntosDeLineas,
  calcularSaldoPuntos,
  estadoPerfil,
  fechaVencimientoPuntos,
  puntosADevolverCancelacion,
  puntosADevolverRenglon,
  puntosAReversar,
} from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { moduloActivo } from '../utils/modulos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/puntos.repository.js';
import * as ser from '../serializers/puntos.serializer.js';

const ULTIMOS = 50;

// Ganar o restar puntos es secundario: si algo falla, el cobro y la entrega NO se detienen
async function seguro(db, fn) {
  await db.query('SAVEPOINT puntos');
  try {
    const r = await fn();
    await db.query('RELEASE SAVEPOINT puntos');
    return r;
  } catch (err) {
    await db.query('ROLLBACK TO SAVEPOINT puntos');
    console.error('No se pudieron registrar los puntos:', err.code ?? err.message);
    return null;
  }
}

const reglaDe = (cfg, tipo) =>
  tipo === 'servicios'
    ? { activo: cfg.ganarServicios, monto: cfg.montoServicios, puntos: cfg.ganadosServicios }
    : { activo: cfg.ganarProductos, monto: cfg.montoProductos, puntos: cfg.ganadosProductos };

const saldoDe = async (db, e, clienteId, hoy) => calcularSaldoPuntos(await repo.movimientosParaSaldo(db, e, clienteId), hoy);

// p: { empresaId, sucursalId, clienteId, tipo: 'productos' | 'servicios', origen, ventaId, clave, usuarioId, lineas: [{ base, descuento }] }
// Devuelve null (no aplica) o { ganados, habriaGanado?, falta? }
async function otorgar(db, p) {
  const e = p.empresaId;
  if (!p.clienteId || !p.lineas.length) return null;
  if (!(await moduloActivo(e, 'promociones'))) return null;

  const cfg = await repo.cargarConfig(db, e, p.sucursalId);
  const regla = reglaDe(cfg, p.tipo);
  if (!regla.activo) return null;

  const { base, puntos } = calcularPuntosDeLineas(p.lineas, regla, { promoDa: cfg.promoDa });
  if (puntos <= 0) return { ganados: 0 };

  const cliente = await repo.cargarCliente(db, e, p.clienteId);
  if (!cliente) return null;
  const perfil = estadoPerfil({ correo: cliente.correo, cumpleMes: cliente.cumple_mes, cumpleDia: cliente.cumple_dia, tienePin: cliente.tiene_pin });
  const falta = [...perfil.falta];
  if (cfg.exigirAviso && !cliente.aviso) falta.push('aviso de privacidad');
  // Sin perfil completo no gana; la Caja avisa cuántos habría ganado
  if (!cliente.activo || falta.length) return { ganados: 0, habriaGanado: puntos, falta };

  const hoy = await repo.hoy(db, e, p.sucursalId);
  const nuevo = await repo.insertarMovimiento(db, e, {
    clienteId: p.clienteId,
    ventaId: p.ventaId,
    sucursalId: p.sucursalId,
    tipo: 'ganado',
    origen: p.origen,
    puntos,
    base,
    venceEn: fechaVencimientoPuntos({ caducidad: cfg.caducidad, meses: cfg.caducidadMeses, fecha: cfg.caducidadFecha }, hoy),
    clave: p.clave,
    usuarioId: p.usuarioId,
  });
  return { ganados: nuevo ? puntos : 0 };
}

// Productos: se ganan al cobrar
export const otorgarSeguro = (db, p) => seguro(db, () => otorgar(db, p));

// Servicios: se ganan al entregar (p: empresaId, sucursalId, ventaId, entregaId, partidaIds, usuarioId)
export const otorgarPorEntregaSeguro = (db, p) =>
  seguro(db, async () => {
    const venta = await repo.clienteDeVenta(db, p.empresaId, p.ventaId);
    if (!venta?.clienteId) return null;
    // Una compra pagada con puntos no gana puntos
    if (await repo.ventaTieneCanje(db, p.empresaId, p.ventaId)) return null;
    const filas = await repo.partidasEntregadas(db, p.empresaId, p.partidaIds);
    // La base es lo que costó el servicio con sus extras, sin el cargo de financiamiento
    const lineas = filas.map((f) => ({ base: aMonto(aCentavos(f.total) - aCentavos(f.cargo) + aCentavos(f.extras)), descuento: f.descuento }));
    return otorgar(db, {
      ...p,
      clienteId: venta.clienteId,
      tipo: 'servicios',
      origen: 'entrega',
      clave: `entrega:${p.entregaId}`,
      lineas,
    });
  });

// Se devolvió dinero de lo que dio puntos: se quitan los puntos proporcionales (sin pasar de lo que el cliente tiene)
// p: { empresaId, sucursalId, ventaId, origen: 'venta' | 'entrega', baseDevuelta, clave, usuarioId }
export const revertirSeguro = (db, p) =>
  seguro(db, async () => {
    const e = p.empresaId;
    const t = await repo.totalesVenta(db, e, p.ventaId, p.origen);
    if (!t.ganados || !t.clienteId) return null;

    const aQuitar = puntosAReversar({ ganados: t.ganados, baseGanada: t.baseGanada, revertidos: t.revertidos, baseDevuelta: t.baseDevuelta, baseNueva: p.baseDevuelta });
    const hoy = await repo.hoy(db, e, p.sucursalId);
    const { saldo } = await saldoDe(db, e, t.clienteId, hoy);
    const quitados = Math.min(aQuitar, saldo);

    await repo.insertarMovimiento(db, e, {
      clienteId: t.clienteId,
      ventaId: p.ventaId,
      sucursalId: p.sucursalId,
      tipo: 'reversa',
      origen: p.origen,
      puntos: -quitados,
      base: p.baseDevuelta,
      clave: p.clave,
      usuarioId: p.usuarioId,
    });
    return { quitados };
  });

// ---------- Consultas ----------
async function armarResumen(db, e, clienteId) {
  const [cfg, movs, ultimos, hoy, modulo] = await Promise.all([
    repo.cargarConfig(db, e, null),
    repo.movimientosParaSaldo(db, e, clienteId),
    repo.ultimosMovimientos(db, e, clienteId, ULTIMOS),
    repo.hoy(db, e, null),
    moduloActivo(e, 'promociones'),
  ]);
  const activo = modulo && (cfg.ganarProductos || cfg.ganarServicios);
  return ser.resumen(calcularSaldoPuntos(movs, hoy), cfg, ultimos, activo);
}

// Para quien atiende (Clientes y Caja)
export async function resumenStaff(actor, clienteId) {
  if (!(await repo.cargarCliente(pool, actor.empresaId, clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');
  return armarResumen(pool, actor.empresaId, clienteId);
}

// Para el propio cliente (Mi cuenta)
export async function resumenCliente(empresaId, clienteId) {
  const r = await armarResumen(pool, empresaId, clienteId);
  return { ...r, movimientos: r.movimientos.map((m) => ({ ...m, motivo: null })) };
}

// ---------- Ajuste a mano ----------
export async function ajustar(actor, clienteId, { id, puntos, motivo }, ip) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera con clientes');
  const e = actor.empresaId;
  if (!(await moduloActivo(e, 'promociones'))) throw new ErrorHttp(403, 'Este módulo no está activo en tu plan');

  return conTransaccion(async (db) => {
    if (!(await repo.bloquearCliente(db, e, clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');

    const hoy = await repo.hoy(db, e, null);
    const { saldo } = await saldoDe(db, e, clienteId, hoy);
    if (puntos < 0 && -puntos > saldo) throw new ErrorHttp(409, `El cliente solo tiene ${saldo} puntos`);

    const cfg = await repo.cargarConfig(db, e, null);
    const nuevo = await repo.insertarMovimiento(db, e, {
      clienteId,
      tipo: 'ajuste',
      origen: 'manual',
      puntos,
      venceEn: puntos > 0 ? fechaVencimientoPuntos({ caducidad: cfg.caducidad, meses: cfg.caducidadMeses, fecha: cfg.caducidadFecha }, hoy) : null,
      motivo,
      clave: `ajuste:${id}`,
      usuarioId: actor.id,
    });
    if (nuevo) {
      await registrarBitacora(db, {
        empresaId: e,
        usuarioId: actor.id,
        accion: 'cliente.ajustar_puntos',
        entidad: 'cliente',
        entidadUuid: clienteId,
        despues: { puntos, motivo },
        ip,
      });
    }
    return { ...(await armarResumen(db, e, clienteId)), repetido: !nuevo };
  });
}

// ---------- Devolver puntos usados (cancelaciones y devoluciones) ----------
// Sin SAVEPOINT: si falla, se deshace todo. Los puntos son del cliente y no deben perderse en silencio.
// p: { empresaId, sucursalId, ventaId, puntos, clave, usuarioId, motivo }
async function devolverPuntos(db, p) {
  const e = p.empresaId;
  if (p.puntos <= 0) return null;
  const t = await repo.totalesCanje(db, e, p.ventaId);
  if (!t.clienteId || t.usados <= 0) return null;
  const puntos = Math.min(p.puntos, t.usados - t.devueltos);
  if (puntos <= 0) return null;

  const [cfg, hoy] = await Promise.all([repo.cargarConfig(db, e, p.sucursalId), repo.hoy(db, e, p.sucursalId)]);
  const nuevo = await repo.insertarMovimiento(db, e, {
    clienteId: t.clienteId,
    ventaId: p.ventaId,
    sucursalId: p.sucursalId,
    tipo: 'ajuste',
    origen: 'canje',
    puntos,
    venceEn: fechaVencimientoPuntos({ caducidad: cfg.caducidad, meses: cfg.caducidadMeses, fecha: cfg.caducidadFecha }, hoy),
    motivo: p.motivo,
    clave: p.clave,
    usuarioId: p.usuarioId,
  });
  return nuevo ? { devueltos: puntos } : null;
}

// Se canceló parte de una nota: vuelven los puntos usados en lo cancelado, menos lo que la tienda retiene.
// p: { empresaId, sucursalId, ventaId, partidaIds, cancelado, retenido, clave, usuarioId }
export async function devolverCanjePorCancelacion(db, p) {
  const filas = await repo.partidasConCanje(db, p.empresaId, p.partidaIds);
  const puntosUsados = filas.reduce((s, f) => s + f.puntos, 0);
  return devolverPuntos(db, {
    ...p,
    puntos: puntosADevolverCancelacion({ puntosUsados, cancelado: p.cancelado, retenido: p.retenido }),
    motivo: 'Se canceló lo que se pagó con puntos',
  });
}

// Devolución de productos: llamarla ANTES de sumar lo devuelto a los renglones.
// p: { empresaId, sucursalId, ventaId, lineas: [{ partidaId, valor }], clave, usuarioId }
export async function devolverCanjePorDevolucion(db, p) {
  const filas = await repo.partidasConCanje(db, p.empresaId, p.lineas.map((l) => l.partidaId));
  const porId = new Map(filas.map((f) => [f.id, f]));
  const puntos = p.lineas.reduce((s, l) => {
    const f = porId.get(l.partidaId);
    return f ? s + puntosADevolverRenglon({ puntosUsados: f.puntos, total: f.total, devueltoAntes: f.valorDevuelto, devueltoAhora: l.valor }) : s;
  }, 0);
  return devolverPuntos(db, { ...p, puntos, motivo: 'Se devolvió lo que se pagó con puntos' });
}