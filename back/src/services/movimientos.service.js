import { aCentavos, aMonto, efectivoPorRetirar } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/movimientos.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as corteRepo from '../repositories/corte.repository.js';
import { autorizar } from './autorizacion.service.js';
import { movimiento } from '../serializers/movimientos.serializer.js';

const PERMISO_ANULAR = 'caja.administrar';

const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};

const redondear = (v) => aMonto(Math.round(aCentavos(Number(v))));

async function turnoVigente(actor) {
  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, actor.empresaId, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para continuar');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
  return turno;
}

// Turno bloqueado: mientras se registra algo, nadie puede cerrarlo
async function bloquear(db, e, turno) {
  const t = await ventasRepo.bloquearTurno(db, e, turno.id);
  if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
  if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
  return t;
}

const bitacora = (db, actor, accion, id, sucursalId, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    sucursalId,
    usuarioId: actor.id,
    accion,
    entidad: 'caja_movimiento',
    entidadUuid: id,
    antes,
    despues,
    ip,
  });

// Gastos y retiros del turno actual, con sus totales y el aviso de retiro (lo anulado no cuenta)
export async function listar(actor) {
  noGlobal(actor);
  const e = actor.empresaId;
  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) {
    return {
      zonaHoraria: null,
      movimientos: [],
      totales: { gastos: 0, retiros: 0 },
      retiro: { limite: 0, acumulado: 0, debeRetirar: false, retirar: 0 },
    };
  }

  const [filas, sumas, limite] = await Promise.all([
    repo.listarDeTurno(pool, e, turno.id),
    corteRepo.sumarTurno(pool, e, turno.id),
    corteRepo.limiteRetiro(pool, e, turno.sucursal_id),
  ]);
  const suma = (tipo) =>
    aMonto(filas.filter((f) => f.tipo === tipo && !f.anulado_en).reduce((s, f) => s + Math.round(aCentavos(Number(f.monto))), 0));
  return {
    zonaHoraria: turno.zona,
    movimientos: filas.map(movimiento),
    totales: { gastos: suma('gasto'), retiros: suma('retiro') },
    retiro: efectivoPorRetirar({ ...sumas, limite }),
  };
}

export async function crear(actor, datos, ip) {
  noGlobal(actor);
  const e = actor.empresaId;

  // Reintento de algo que ya se guardó: se devuelve lo mismo, sin registrar de nuevo
  const previo = await repo.buscar(pool, e, datos.id);
  if (previo) {
    if (previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Ese movimiento ya existe');
    return { ...movimiento(previo), repetido: true };
  }

  const turno = await turnoVigente(actor);

  return conTransaccion(async (db) => {
    const t = await bloquear(db, e, turno);
    const esGasto = datos.tipo === 'gasto';
    const monto = redondear(datos.monto);

    const creado = await repo.insertar(db, e, {
      id: datos.id,
      sucursalId: t.sucursal_id,
      turnoId: t.id,
      cajaId: t.caja_id,
      usuarioId: actor.id,
      tipo: datos.tipo,
      categoria: esGasto ? datos.categoria : null,
      concepto: esGasto ? datos.concepto : 'Retiro de efectivo',
      monto,
      recibe: esGasto ? null : datos.recibe,
      referencia: esGasto ? datos.referencia ?? null : null,
    });
    if (!creado) throw new ErrorHttp(409, 'Este movimiento ya se registró');

    await bitacora(
      db, actor, esGasto ? 'caja.gasto' : 'caja.retiro', datos.id, t.sucursal_id, null,
      { tipo: datos.tipo, categoria: esGasto ? datos.categoria : null, concepto: esGasto ? datos.concepto : null, monto, recibe: esGasto ? null : datos.recibe },
      ip
    );
    return { ...movimiento(await repo.buscar(db, e, datos.id)), repetido: false };
  });
}

// Anular un gasto o retiro del turno en curso: lo autoriza un gerente o administrador, con motivo
export async function anular(actor, id, datos, ip) {
  noGlobal(actor);
  const e = actor.empresaId;
  const turno = await turnoVigente(actor);

  const previo = await repo.buscar(pool, e, id);
  if (!previo || previo.turno_id !== turno.id) throw new ErrorHttp(404, 'Movimiento no encontrado en tu turno');
  if (previo.anulado_en) throw new ErrorHttp(409, 'Ese movimiento ya está anulado');

  const autorizo = await autorizar(actor, turno.sucursal_id, datos.autorizacion, PERMISO_ANULAR);

  return conTransaccion(async (db) => {
    const t = await bloquear(db, e, turno);
    const ok = await repo.anular(db, e, id, t.id, { por: actor.id, autorizadoPor: autorizo.id, motivo: datos.motivo });
    if (!ok) throw new ErrorHttp(409, 'Ese movimiento ya está anulado');

    await bitacora(
      db, actor, 'caja.movimiento_anular', id, t.sucursal_id,
      { tipo: previo.tipo, concepto: previo.concepto, monto: Number(previo.monto) },
      { autorizadoPor: autorizo.id, motivo: datos.motivo },
      ip
    );
    return movimiento(await repo.buscar(db, e, id));
  });
}