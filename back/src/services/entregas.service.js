import { evaluarEntrega, mensajeSaldoPendiente, resumenNota } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { verificarPin } from '../utils/pin.js';
import * as repo from '../repositories/entregas.repository.js';
import * as listaRepo from '../repositories/notasLista.repository.js';
import * as configRepo from '../repositories/notas.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as intentosRepo from '../repositories/intentos.repository.js';
import { cargarDetalle } from './notas.service.js';
import { autorizar, limitarIntentos } from './autorizacion.service.js';
import { ticketEntrega } from '../serializers/entregas.serializer.js';

const MAX_FALLOS = 5;
const VENTANA_MIN = 15;
const PERMISO_AUTORIZAR = 'caja.autorizar_entrega';

const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};

const limitar = limitarIntentos;

async function verificarPinCliente(empresaId, ventaId, hash, pin) {
  if (!hash) throw new ErrorHttp(409, 'Esta nota no tiene PIN. Pide la autorización de un encargado.');
  const clave = `entrega:${ventaId}`;
  await limitar(empresaId, clave, 'Demasiados intentos con el PIN de esta nota. Pide la autorización de un encargado.');
  if (!(await verificarPin(pin, hash))) {
    await intentosRepo.registrarFallo(pool, empresaId, clave, '');
    throw new ErrorHttp(403, 'PIN incorrecto');
  }
  await intentosRepo.limpiarFallos(pool, empresaId, clave);
}

// La autorización de un encargado vive en autorizacion.service.js (la usan entregas, cancelaciones y reembolsos)
const verificarAutorizacion = (actor, sucursalId, a) => autorizar(actor, sucursalId, a, PERMISO_AUTORIZAR);

async function armarTicket(db, actor, ventaId, entregaId, repetida) {
  const detalle = await cargarDetalle(db, actor, ventaId);
  if (!detalle) throw new ErrorHttp(404, 'Nota no encontrada');
  const datos = await repo.cargarEntrega(db, actor.empresaId, entregaId);
  if (!datos.entrega) throw new ErrorHttp(404, 'Entrega no encontrada');
  return ticketEntrega(detalle, datos, repetida);
}

export async function entregar(actor, ventaId, datos, ip) {
  noGlobal(actor);
  const e = actor.empresaId;

  // Reintento de una entrega que ya se guardó: se devuelve el mismo ticket, sin entregar de nuevo
  const previo = await repo.buscarEntrega(pool, e, datos.id);
  if (previo) {
    if (previo.venta_id !== ventaId || previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Esa entrega ya existe');
    return armarTicket(pool, actor, ventaId, datos.id, true);
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para entregar');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  // Solo se entregan notas de la misma sucursal del turno
  const nota = await repo.datosParaEntrega(pool, e, ventaId, [turno.sucursal_id]);
  if (!nota || !nota.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');

  // Con saldo no se entrega (y así nadie prueba PINs en una nota que todavía debe)
  const aviso = mensajeSaldoPendiente(
    resumenNota({
      total: nota.total,
      cancelado: nota.cancelado,
      ajustado: nota.ajustado,
      retenido: nota.retenido,
      reembolsado: nota.reembolsado,
      cobrado: nota.pagado,
    }).saldo
  );
  if (aviso) throw new ErrorHttp(409, aviso);

  const config = await configRepo.cargarConfig(pool, e, nota.sucursal_id);
  let metodo;
  let autorizo = null;
  if (datos.autorizacion) {
    autorizo = await verificarAutorizacion(actor, nota.sucursal_id, datos.autorizacion);
    metodo = 'autorizacion';
  } else if (!config.pinEntregaActivo) {
    metodo = 'sin_pin';
  } else {
    if (!datos.pin) throw new ErrorHttp(400, 'Pide el PIN al cliente');
    await verificarPinCliente(e, ventaId, nota.pin_entrega_hash, datos.pin);
    metodo = 'pin';
  }

  return conTransaccion(async (db) => {
    const t = await ventasRepo.bloquearTurno(db, e, turno.id);
    if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
    if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

    const venta = await listaRepo.bloquearVenta(db, e, ventaId, [t.sucursal_id]);
    if (!venta || !venta.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');

    // Todo se vuelve a revisar con la nota bloqueada
    const saldo = resumenNota({
      total: venta.total,
      cancelado: venta.cancelado,
      ajustado: venta.ajustado,
      retenido: venta.retenido,
      reembolsado: venta.reembolsado,
      cobrado: await listaRepo.totalPagado(db, e, ventaId),
    }).saldo;
    const filas = await listaRepo.cargarPartidasEstado(db, e, ventaId);
    const veredicto = evaluarEntrega({
      saldo,
      articulos: filas.map((f) => ({ id: f.partida_id, estado: f.estado_trabajo })),
      elegidos: datos.partidaIds,
    });
    if (!veredicto.ok) throw new ErrorHttp(409, veredicto.motivo);

    const creada = await repo.insertarEntrega(db, e, {
      id: datos.id,
      ventaId,
      sucursalId: t.sucursal_id,
      turnoId: t.id,
      cajaId: t.caja_id,
      usuarioId: actor.id,
      metodo,
      autorizadoPor: autorizo?.id ?? null,
      recoge: datos.recoge ?? null,
      motivo: datos.autorizacion?.motivo ?? null,
      articulos: datos.partidaIds.length,
    });
    if (!creada) throw new ErrorHttp(409, 'Esta entrega ya se registró');

    const marcadas = await repo.marcarEntregados(db, e, datos.partidaIds, datos.id, actor.id);
    if (marcadas !== datos.partidaIds.length) throw new ErrorHttp(409, 'Un artículo cambió de estado. Vuelve a intentarlo.');

    for (const partidaId of datos.partidaIds) {
      await listaRepo.registrarCambioEstado(db, e, { partidaId, anterior: 'listo', nuevo: 'entregado', usuarioId: actor.id, motivo: null });
    }

    // La bitácora nunca lleva PIN
    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      usuarioId: actor.id,
      accion: 'nota.entregar',
      entidad: 'venta',
      entidadUuid: ventaId,
      antes: null,
      despues: {
        entregaId: datos.id,
        metodo,
        articulos: datos.partidaIds.length,
        recoge: datos.recoge ?? null,
        autorizadoPor: autorizo?.id ?? null,
        motivo: datos.autorizacion?.motivo ?? null,
      },
      ip,
    });

    return armarTicket(db, { ...actor, sucursales: [t.sucursal_id] }, ventaId, datos.id, false);
  });
}