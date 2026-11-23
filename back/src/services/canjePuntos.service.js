import { calcularSaldoPuntos, resolverCanje } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { moduloActivo } from '../utils/modulos.js';
import { verificarPin } from '../utils/pin.js';
import { autorizar, limitarIntentos } from './autorizacion.service.js';
import { contextoDelTurno } from './cajaCatalogo.service.js';
import * as puntosRepo from '../repositories/puntos.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as intentosRepo from '../repositories/intentos.repository.js';

const PERMISO_ENCARGADO = 'caja.descuentos';

// Antes de la transacción (los intentos fallidos se guardan aparte y no se deshacen).
// Autoriza el propio cliente con su PIN o un encargado. Devuelve { metodo, autorizoId }.
export async function autorizarCanje(actor, sucursalId, { clienteId, canje }) {
  const e = actor.empresaId;
  if (!(await moduloActivo(e, 'promociones'))) throw new ErrorHttp(403, 'Este módulo no está activo en tu plan');
  if (!clienteId) throw new ErrorHttp(400, 'Para usar puntos elige al cliente registrado.');

  if (canje.autorizacion) {
    const enc = await autorizar(actor, sucursalId, canje.autorizacion, PERMISO_ENCARGADO);
    return { metodo: 'encargado', autorizoId: enc.id };
  }

  const claveCliente = `canje:${clienteId}`;
  const claveActor = `canjeactor:${actor.id}`;
  await limitarIntentos(e, claveCliente, 'Demasiados intentos con el PIN de este cliente. Espera unos minutos.');
  await limitarIntentos(e, claveActor, 'Demasiados intentos. Espera unos minutos.');

  const c = await clientesRepo.pinDeCliente(pool, e, clienteId);
  if (!c || !c.activo) throw new ErrorHttp(404, 'Cliente no encontrado');
  if (!c.pin_hash) throw new ErrorHttp(400, 'Este cliente aún no tiene PIN. Un encargado puede autorizar, o genera su PIN en Clientes.');
  if (!(await verificarPin(canje.pinCliente, c.pin_hash))) {
    await intentosRepo.registrarFallo(pool, e, claveCliente, '');
    await intentosRepo.registrarFallo(pool, e, claveActor, '');
    throw new ErrorHttp(403, 'El PIN del cliente no es correcto.');
  }
  await intentosRepo.limpiarFallos(pool, e, claveCliente);
  return { metodo: 'pin_cliente', autorizoId: null };
}

// Dentro de la transacción: bloquea al cliente, recalcula todo con el saldo real y rebaja las partidas.
// c: { empresaId, sucursalId, clienteId, puntos, productos, servicios, incluyeIva }
export async function aplicarCanje(db, c) {
  const e = c.empresaId;
  const cfg = await puntosRepo.cargarConfig(db, e, c.sucursalId);
  if (!cfg.canjearProductos && !cfg.canjearServicios) throw new ErrorHttp(409, 'El canje de puntos no está activo en esta sucursal.');
  if (!(await puntosRepo.bloquearCliente(db, e, c.clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');

  const hoy = await puntosRepo.hoy(db, e, c.sucursalId);
  const { saldo } = calcularSaldoPuntos(await puntosRepo.movimientosParaSaldo(db, e, c.clienteId), hoy);

  const r = resolverCanje({
    productos: c.productos,
    servicios: c.servicios,
    saldo,
    puntos: c.puntos,
    incluyeIva: c.incluyeIva,
    ajustes: {
      valor: cfg.valor,
      topePct: cfg.topeCanje,
      minimo: cfg.minimoCanje,
      canjearProductos: cfg.canjearProductos,
      canjearServicios: cfg.canjearServicios,
      enPromo: cfg.canjeEnPromo,
    },
  });
  if (!r.ok) throw new ErrorHttp(409, r.error);

  return { productos: r.productos, servicios: r.servicios, canje: { puntos: r.puntos, descuento: r.descuento } };
}

// Se anota junto con la venta: si algo falla, todo se deshace
export async function registrarCanje(db, p) {
  const nuevo = await puntosRepo.insertarMovimiento(db, p.empresaId, {
    clienteId: p.clienteId,
    ventaId: p.ventaId,
    sucursalId: p.sucursalId,
    tipo: 'canje',
    origen: 'canje',
    puntos: -p.canje.puntos,
    base: p.canje.descuento,
    clave: `canje:${p.ventaId}`,
    usuarioId: p.usuarioId,
  });
  if (!nuevo) throw new ErrorHttp(409, 'Este canje ya se registró');
}

// Lo que la Caja necesita para ofrecer "Usar puntos" a un cliente (el servidor vuelve a calcular todo al cobrar)
export async function consultarCanje(actor, clienteId) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
  const e = actor.empresaId;
  const { sucursalId } = await contextoDelTurno(actor);
  if (!(await moduloActivo(e, 'promociones'))) return { disponible: false };

  const cfg = await puntosRepo.cargarConfig(pool, e, sucursalId);
  const cliente = await puntosRepo.cargarCliente(pool, e, clienteId);
  if (!cliente || !cliente.activo) throw new ErrorHttp(404, 'Cliente no encontrado');

  const hoy = await puntosRepo.hoy(pool, e, sucursalId);
  const { saldo, porVencer } = calcularSaldoPuntos(await puntosRepo.movimientosParaSaldo(pool, e, clienteId), hoy);
  return {
    disponible: Boolean((cfg.canjearProductos || cfg.canjearServicios) && cfg.topeCanje > 0 && cfg.valor > 0),
    saldo,
    porVencer,
    tienePin: cliente.tiene_pin,
    ajustes: {
      valor: cfg.valor,
      topePct: cfg.topeCanje,
      minimo: cfg.minimoCanje,
      canjearProductos: cfg.canjearProductos,
      canjearServicios: cfg.canjearServicios,
      enPromo: cfg.canjeEnPromo,
    },
  };
}