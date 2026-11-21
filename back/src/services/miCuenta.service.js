import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool, conTransaccion } from '../config/db.js';
import { firmarToken } from '../utils/tokens.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { hashPin, verificarPin } from '../utils/pin.js';
import { versionPin } from '../middlewares/autenticarCliente.js';
import * as intentos from '../repositories/intentos.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as repo from '../repositories/miCuenta.repository.js';
import * as ser from '../serializers/miCuenta.serializer.js';
import { resumenCliente } from './puntos.service.js';

const DURACION_SESION_SEG = 2 * 60 * 60;
const VENTANA_MIN = 15;
const MAX_POR_TELEFONO = 5;
const MAX_POR_IP = 30;
const LIMITE_LISTAS = 20;

// Se compara contra esto cuando el teléfono no existe, para que tarde igual
const HASH_FALSO = bcrypt.hashSync(crypto.randomUUID(), 12);
const MENSAJE_ENTRADA = 'Teléfono o PIN incorrectos. Si aún no tienes PIN, pídelo en tu sucursal.';

const claveIntentos = (telefono) => `cliente:${telefono}`;

// La bitácora no lleva PIN ni datos personales: solo qué se cambió
const bitacora = (db, cliente, accion, despues, ip) =>
  registrarBitacora(db, {
    empresaId: cliente.empresaId,
    accion,
    entidad: 'cliente',
    entidadUuid: cliente.id,
    antes: null,
    despues: { ...despues, porElCliente: true },
    ip,
  });

const firmarSesion = (empresaId, fila) =>
  firmarToken('cliente', { cid: fila.id, eid: empresaId, pv: versionPin(fila) }, DURACION_SESION_SEG);

export async function iniciarSesion(empresa, { telefono, pin }, ip) {
  const e = empresa.id;
  const clave = claveIntentos(telefono);
  const fallos = await intentos.contarFallos(pool, e, clave, ip, VENTANA_MIN);
  if (fallos.porUsuario >= MAX_POR_TELEFONO || fallos.porIp >= MAX_POR_IP) {
    throw new ErrorHttp(429, 'Demasiados intentos. Espera unos minutos.');
  }

  const fila = await repo.buscarParaLogin(pool, e, telefono);
  const coincide = await verificarPin(pin, fila?.pin_hash || HASH_FALSO);
  // Mismo mensaje para teléfono inexistente, sin PIN, dado de baja o PIN malo
  if (!fila || !fila.pin_hash || !fila.activo || !coincide) {
    await intentos.registrarFallo(pool, e, clave, ip);
    throw new ErrorHttp(401, MENSAJE_ENTRADA);
  }
  await intentos.limpiarFallos(pool, e, clave);

  return {
    token: firmarSesion(e, fila),
    cliente: ser.datosCliente(await repo.obtener(pool, e, fila.id)),
  };
}

export async function perfil(cliente) {
  return ser.datosCliente(await repo.obtener(pool, cliente.empresaId, cliente.id));
}

export async function pedidos(cliente) {
  const e = cliente.empresaId;
  const notas = await repo.listarNotas(pool, e, cliente.id, LIMITE_LISTAS);
  const servicios = notas.length ? await repo.serviciosDeNotas(pool, e, notas.map((x) => x.id)) : [];
  const porNota = new Map();
  for (const s of servicios) porNota.set(s.venta_id, [...(porNota.get(s.venta_id) ?? []), s]);
  return { datos: notas.map((x) => ser.pedido(x, porNota.get(x.id) ?? [])) };
}

export async function compras(cliente) {
  const filas = await repo.listarCompras(pool, cliente.empresaId, cliente.id, LIMITE_LISTAS);
  return { datos: filas.map(ser.compra) };
}

// Cambiar datos o el PIN pide el PIN actual. Los fallos cuentan en el mismo límite que el inicio de sesión.
async function exigirPin(cliente, pin, ip) {
  const e = cliente.empresaId;
  const clave = claveIntentos(cliente.telefono);
  const fallos = await intentos.contarFallos(pool, e, clave, ip, VENTANA_MIN);
  if (fallos.porUsuario >= MAX_POR_TELEFONO) throw new ErrorHttp(429, 'Demasiados intentos con el PIN. Espera unos minutos.');

  const hash = await repo.pinHashDe(pool, e, cliente.id);
  if (!hash || !(await verificarPin(pin, hash))) {
    await intentos.registrarFallo(pool, e, clave, ip);
    // 403 y no 401: un PIN equivocado no cierra la sesión
    throw new ErrorHttp(403, 'PIN incorrecto');
  }
  await intentos.limpiarFallos(pool, e, clave);
}

export async function actualizarDatos(cliente, { pin, correo, cumpleanos }, ip) {
  await exigirPin(cliente, pin, ip);
  const e = cliente.empresaId;
  return conTransaccion(async (db) => {
    const campos = {};
    if (correo !== undefined) campos.correo = correo;
    if (cumpleanos !== undefined) {
      campos.cumple_mes = cumpleanos.mes;
      campos.cumple_dia = cumpleanos.dia;
    }
    await repo.actualizarDatos(db, e, cliente.id, campos);
    await bitacora(db, cliente, 'cliente.cambiar_datos', { campos: Object.keys(campos) }, ip);
    return ser.datosCliente(await repo.obtener(db, e, cliente.id));
  });
}

// Devuelve una sesión nueva: la anterior deja de servir porque el PIN cambió
export async function cambiarPin(cliente, { pinActual, pinNuevo }, ip) {
  await exigirPin(cliente, pinActual, ip);
  const e = cliente.empresaId;
  const hash = await hashPin(pinNuevo);
  return conTransaccion(async (db) => {
    if (!(await clientesRepo.guardarPin(db, e, cliente.id, hash, true))) throw new ErrorHttp(409, 'No se pudo cambiar el PIN');
    await bitacora(db, cliente, 'cliente.cambiar_pin', {}, ip);
    const fila = await repo.buscarParaLogin(db, e, cliente.telefono);
    return { token: firmarSesion(e, fila) };
  });
}

export async function aceptarAviso(cliente, ip) {
  const e = cliente.empresaId;
  return conTransaccion(async (db) => {
    await repo.marcarAviso(db, e, cliente.id);
    await bitacora(db, cliente, 'cliente.aceptar_aviso', {}, ip);
    return ser.datosCliente(await repo.obtener(db, e, cliente.id));
  });
}

export const puntos = (cliente) => resumenCliente(cliente.empresaId, cliente.id);