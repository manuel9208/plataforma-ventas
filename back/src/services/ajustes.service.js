import { aCentavos, aMonto, planCancelacion, planReembolso } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/ajustes.repository.js';
import * as listaRepo from '../repositories/notasLista.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import { autorizar } from './autorizacion.service.js';
import { liberarCuponSiCancelada } from './cuponesCaja.service.js';
import { devolverCanjePorCancelacion, revertirSeguro } from './puntos.service.js';
import { cargarDetalle } from './notas.service.js';
import { comprobante } from '../serializers/ajustes.serializer.js';

const PERMISO = 'notas.cancelar';
const EN_ESPERA = ['recibido', 'en_proceso'];

const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};

async function armarComprobante(db, actor, ventaId, ajusteId, repetido) {
  const detalle = await cargarDetalle(db, actor, ventaId);
  const datos = await repo.cargarAjuste(db, actor.empresaId, ajusteId);
  if (!detalle || !datos.ajuste) throw new ErrorHttp(404, 'Operación no encontrada');
  return comprobante(detalle, datos, repetido);
}

// Pasos comunes antes de pedir el PIN: reintento, turno abierto y nota de esta sucursal
async function preparar(actor, ventaId, datos) {
  noGlobal(actor);
  const e = actor.empresaId;

  const previo = await repo.buscarAjuste(pool, e, datos.id);
  if (previo) {
    if (previo.venta_id !== ventaId || previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Esa operación ya existe');
    return { repetido: await armarComprobante(pool, actor, ventaId, datos.id, true) };
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para continuar');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  const nota = await repo.buscarNota(pool, e, ventaId, [turno.sucursal_id]);
  if (!nota || !nota.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');

  const autorizo = await autorizar(actor, nota.sucursal_id, datos.autorizacion, PERMISO);
  return { turno, nota, autorizo };
}

// Turno y nota bloqueados, y los números de la nota listos para la fórmula
async function bloquear(db, e, turno, ventaId) {
  const t = await ventasRepo.bloquearTurno(db, e, turno.id);
  if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
  if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
  const venta = await listaRepo.bloquearVenta(db, e, ventaId, [t.sucursal_id]);
  if (!venta || !venta.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');
  const filas = await repo.partidasDeVenta(db, e, ventaId);
  const vig = await repo.valoresVigentes(db, e, ventaId);
  const datosNota = {
    total: Number(venta.total),
    cancelado: Number(venta.cancelado),
    ajustado: Number(venta.ajustado),
    retenido: Number(venta.retenido),
    reembolsado: Number(venta.reembolsado),
    cobrado: await listaRepo.totalPagado(db, e, ventaId),
    productosVigentes: vig.productos,
    serviciosVigentes: vig.servicios,
    serviciosHechos: vig.hechos,
  };
  return { t, filas, datosNota };
}

const sumaC = (lista) => lista.reduce((s, f) => s + aCentavos(Number(f.total)), 0);

// ---------- Cancelar productos y/o servicios en espera, con devolución opcional ----------
export async function cancelar(actor, ventaId, datos, ip) {
  const p = await preparar(actor, ventaId, datos);
  if (p.repetido) return p.repetido;
  const { turno, autorizo } = p;
  const e = actor.empresaId;

  return conTransaccion(async (db) => {
    const { t, filas, datosNota } = await bloquear(db, e, turno, ventaId);

    const porId = new Map(filas.map((f) => [f.id, f]));
    const elegidas = datos.partidaIds.map((id) => porId.get(id));
    for (const f of elegidas) {
      if (!f) throw new ErrorHttp(400, 'Hay un artículo que no pertenece a esta nota');
      if (f.tipo !== 'producto' && f.tipo !== 'servicio') throw new ErrorHttp(400, 'Los extras se cancelan junto con su servicio');
      if (f.ajuste_id) throw new ErrorHttp(409, 'Ese artículo ya se canceló o se devolvió');
      if (f.tipo === 'servicio' && !EN_ESPERA.includes(f.estado_trabajo)) {
        throw new ErrorHttp(409, 'Un artículo Listo o Entregado ya no se cancela. Usa "Reembolso".');
      }
    }

    // Los extras viajan con su servicio
    const servicios = elegidas.filter((f) => f.tipo === 'servicio');
    const idsServicio = new Set(servicios.map((f) => f.id));
    const extras = filas.filter((f) => f.tipo === 'extra' && idsServicio.has(f.padre_partida_id) && !f.ajuste_id);
    const productos = elegidas.filter((f) => f.tipo === 'producto');

    let plan;
    try {
      plan = planCancelacion(
        datosNota,
        { productos: aMonto(sumaC(productos)), servicios: aMonto(sumaC(servicios) + sumaC(extras)) },
        datos.devolver
      );
    } catch (err) {
      throw new ErrorHttp(400, err.message);
    }

    const creada = await repo.insertarAjuste(db, e, {
      id: datos.id,
      ventaId,
      sucursalId: t.sucursal_id,
      turnoId: t.id,
      cajaId: t.caja_id,
      usuarioId: actor.id,
      tipo: 'cancelacion',
      autorizadoPor: autorizo.id,
      motivo: datos.motivo,
      valorCancelado: plan.cancelado,
      tope: plan.tope,
      devuelto: plan.devuelto,
      retenido: plan.retenido,
    });
    if (!creada) throw new ErrorHttp(409, 'Esta operación ya se registró');

    const ids = [...elegidas.map((f) => f.id), ...extras.map((f) => f.id)];
    if ((await repo.marcarPartidas(db, e, ids, datos.id)) !== ids.length) {
      throw new ErrorHttp(409, 'La nota cambió mientras se cancelaba. Vuelve a intentarlo.');
    }
    if (servicios.length) {
      if ((await repo.cancelarServicios(db, e, servicios.map((f) => f.id))) !== servicios.length) {
        throw new ErrorHttp(409, 'Un artículo cambió de estado. Vuelve a intentarlo.');
      }
      for (const f of servicios) {
        await listaRepo.registrarCambioEstado(db, e, {
          partidaId: f.id,
          anterior: f.estado_trabajo,
          nuevo: 'cancelado',
          usuarioId: actor.id,
          motivo: datos.motivo,
        });
      }
    }
    if (plan.devuelto > 0) {
      await repo.insertarReembolso(db, e, {
        ajusteId: datos.id,
        ventaId,
        turnoId: t.id,
        cajaId: t.caja_id,
        usuarioId: actor.id,
        forma: datos.forma,
        monto: plan.devuelto,
        referencia: datos.referencia,
      });
    }
    await repo.sumarAjustes(db, e, ventaId, { cancelado: plan.cancelado, ajustado: 0, retenido: plan.retenido, reembolsado: plan.devuelto });
    // Si la nota quedó cancelada completa, el cupón que usó se libera
    await liberarCuponSiCancelada(db, { empresaId: e, sucursalId: t.sucursal_id, ventaId, usuarioId: actor.id });

    // Los productos cancelados dejan de dar puntos
    if (productos.length) {
      await revertirSeguro(db, { empresaId: e, sucursalId: t.sucursal_id, ventaId, origen: 'venta', baseDevuelta: aMonto(sumaC(productos)), clave: `reversa:${datos.id}`, usuarioId: actor.id });
    }

    // Los puntos usados en lo cancelado regresan al cliente (menos la parte que la tienda retiene)
    await devolverCanjePorCancelacion(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      ventaId,
      partidaIds: elegidas.map((f) => f.id),
      cancelado: plan.cancelado,
      retenido: plan.retenido,
      clave: `canjedev:${datos.id}`,
      usuarioId: actor.id,
    });

    // La bitácora nunca lleva PIN
    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      usuarioId: actor.id,
      accion: 'nota.cancelar',
      entidad: 'venta',
      entidadUuid: ventaId,
      antes: null,
      despues: {
        ajusteId: datos.id,
        articulos: elegidas.length,
        cancelado: plan.cancelado,
        tope: plan.tope,
        devuelto: plan.devuelto,
        retenido: plan.retenido,
        forma: plan.devuelto > 0 ? datos.forma : null,
        autorizadoPor: autorizo.id,
        motivo: datos.motivo,
      },
      ip,
    });

    return armarComprobante(db, { ...actor, sucursales: [t.sucursal_id] }, ventaId, datos.id, false);
  });
}

// ---------- Reembolso suelto: se regresa dinero sin quitar el trabajo (Listo o Entregado) ----------
export async function reembolsar(actor, ventaId, datos, ip) {
  const p = await preparar(actor, ventaId, datos);
  if (p.repetido) return p.repetido;
  const { turno, autorizo } = p;
  const e = actor.empresaId;

  return conTransaccion(async (db) => {
    const { t, datosNota } = await bloquear(db, e, turno, ventaId);

    let plan;
    try {
      plan = planReembolso(datosNota, datos.monto);
    } catch (err) {
      throw new ErrorHttp(400, err.message);
    }

    const creada = await repo.insertarAjuste(db, e, {
      id: datos.id,
      ventaId,
      sucursalId: t.sucursal_id,
      turnoId: t.id,
      cajaId: t.caja_id,
      usuarioId: actor.id,
      tipo: 'reembolso',
      autorizadoPor: autorizo.id,
      motivo: datos.motivo,
      valorCancelado: 0,
      tope: plan.tope,
      devuelto: plan.monto,
      retenido: 0,
    });
    if (!creada) throw new ErrorHttp(409, 'Esta operación ya se registró');

    await repo.insertarReembolso(db, e, {
      ajusteId: datos.id,
      ventaId,
      turnoId: t.id,
      cajaId: t.caja_id,
      usuarioId: actor.id,
      forma: datos.forma,
      monto: plan.monto,
      referencia: datos.referencia,
    });
    await repo.sumarAjustes(db, e, ventaId, { cancelado: 0, ajustado: plan.monto, retenido: 0, reembolsado: plan.monto });

    // Lo reembolsado deja de dar puntos
    await revertirSeguro(db, { empresaId: e, sucursalId: t.sucursal_id, ventaId, origen: 'entrega', baseDevuelta: plan.monto, clave: `reversa:${datos.id}`, usuarioId: actor.id });

    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      usuarioId: actor.id,
      accion: 'nota.reembolsar',
      entidad: 'venta',
      entidadUuid: ventaId,
      antes: null,
      despues: { ajusteId: datos.id, monto: plan.monto, tope: plan.tope, forma: datos.forma, autorizadoPor: autorizo.id, motivo: datos.motivo },
      ip,
    });

    return armarComprobante(db, { ...actor, sucursales: [t.sucursal_id] }, ventaId, datos.id, false);
  });
}