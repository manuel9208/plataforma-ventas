import { planDevolucionVenta } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/ventasMostrador.repository.js';
import * as ajustesRepo from '../repositories/ajustes.repository.js';
import * as listaRepo from '../repositories/notasLista.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import { autorizar } from './autorizacion.service.js';
import { devolverCanjePorDevolucion, revertirSeguro } from './puntos.service.js';
import { ventaLista, ventaDetalle, comprobanteDevolucion } from '../serializers/ventasMostrador.serializer.js';

const PERMISO_AUTORIZAR = 'notas.cancelar';

const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};
// Gerente y administrador ven todas las ventas; los demás solo las de su turno actual
const veTodas = (actor) => tienePermiso(actor.permisos, 'notas.gestionar');

async function alcance(actor) {
  noGlobal(actor);
  if (veTodas(actor)) return { sucursales: actor.sucursales, turnoId: null, completo: true };
  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, actor.empresaId, actor.id);
  if (!turno) return { sucursales: [], turnoId: null, completo: false };
  return { sucursales: [turno.sucursal_id], turnoId: turno.id, completo: false };
}

async function cargarDetalle(db, e, sucursales, id) {
  const v = await repo.obtener(db, e, sucursales, id);
  if (!v) return null;
  const [productos, pagos, reembolsos] = await Promise.all([
    repo.listarProductos(db, e, id),
    listaRepo.listarPagosConQuien(db, e, id),
    ajustesRepo.listarReembolsos(db, e, id),
  ]);
  return ventaDetalle(v, productos, pagos, reembolsos);
}

const partida = (f) => ({
  id: f.id,
  tipo: f.tipo,
  nombre: f.nombre,
  unidad: f.unidad,
  cantidad: Number(f.cantidad),
  cantidadDevuelta: Number(f.cantidad_devuelta),
  total: Number(f.total),
  valorDevuelto: Number(f.valor_devuelto),
  ajusteId: f.ajuste_id,
});

async function armarComprobante(db, e, sucursales, ventaId, ajusteId, repetido) {
  const [detalle, base, lineas] = await Promise.all([
    cargarDetalle(db, e, sucursales, ventaId),
    ajustesRepo.cargarAjuste(db, e, ajusteId),
    repo.lineasDeAjuste(db, e, ajusteId),
  ]);
  if (!detalle || !base.ajuste) throw new ErrorHttp(404, 'Operación no encontrada');
  return comprobanteDevolucion(detalle, { ajuste: base.ajuste, lineas, reembolso: base.reembolso }, repetido);
}

// ---------- Lista ----------
export async function listar(actor, consulta) {
  const a = await alcance(actor);
  let sucursales = a.sucursales;
  if (consulta.sucursalId) {
    if (!sucursales.includes(consulta.sucursalId)) throw new ErrorHttp(403, 'No tienes acceso a esa sucursal');
    sucursales = [consulta.sucursalId];
  }
  const base = { pagina: consulta.pagina, limite: consulta.limite, verTodas: a.completo };
  if (!sucursales.length) return { datos: [], total: 0, ...base };

  const { filas, total } = await repo.listar(pool, actor.empresaId, sucursales, { ...consulta, turnoId: a.turnoId });
  return { datos: filas.map(ventaLista), total, ...base };
}

export async function obtener(actor, id) {
  const a = await alcance(actor);
  const d = a.sucursales.length ? await cargarDetalle(pool, actor.empresaId, a.sucursales, id) : null;
  if (!d || (a.turnoId && d.turnoId !== a.turnoId)) throw new ErrorHttp(404, 'Venta no encontrada');
  return d;
}

// Copia marcada COPIA, sin PIN y con registro en bitácora
export async function copia(actor, id, ip) {
  const d = await obtener(actor, id);
  await registrarBitacora(pool, {
    empresaId: actor.empresaId,
    sucursalId: d.sucursalId,
    usuarioId: actor.id,
    accion: 'venta.copia',
    entidad: 'venta',
    entidadUuid: id,
    antes: null,
    despues: { folio: d.folio },
    ip,
  });
  return { ...d, esCopia: true };
}

// ---------- Devolución de productos (por cantidad) ----------
export async function devolver(actor, ventaId, datos, ip) {
  noGlobal(actor);
  const e = actor.empresaId;

  // Reintento de algo que ya se guardó: se devuelve el mismo comprobante, sin devolver de nuevo
  const previo = await ajustesRepo.buscarAjuste(pool, e, datos.id);
  if (previo) {
    if (previo.venta_id !== ventaId || previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Esa operación ya existe');
    return armarComprobante(pool, e, actor.sucursales, ventaId, datos.id, true);
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para continuar');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  const venta = await repo.datosBasicos(pool, e, ventaId, [turno.sucursal_id]);
  if (!venta || venta.tiene_servicios) throw new ErrorHttp(404, 'Venta no encontrada en esta sucursal');
  if (!veTodas(actor) && venta.turno_id !== turno.id) throw new ErrorHttp(403, 'Solo puedes devolver ventas de tu turno actual');

  const autorizo = await autorizar(actor, venta.sucursal_id, datos.autorizacion, PERMISO_AUTORIZAR);

  return conTransaccion(async (db) => {
    const t = await ventasRepo.bloquearTurno(db, e, turno.id);
    if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
    if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

    const bloqueada = await listaRepo.bloquearVenta(db, e, ventaId, [t.sucursal_id]);
    if (!bloqueada || bloqueada.tiene_servicios) throw new ErrorHttp(404, 'Venta no encontrada en esta sucursal');

    // Todo se calcula aquí, con la venta bloqueada
    const filas = await repo.partidasParaDevolver(db, e, ventaId);
    const vigentes = await ajustesRepo.valoresVigentes(db, e, ventaId);
    const datosNota = {
      total: Number(bloqueada.total),
      cancelado: Number(bloqueada.cancelado),
      ajustado: Number(bloqueada.ajustado),
      retenido: Number(bloqueada.retenido),
      reembolsado: Number(bloqueada.reembolsado),
      cobrado: await listaRepo.totalPagado(db, e, ventaId),
      productosVigentes: vigentes.productos,
      serviciosVigentes: 0,
      serviciosHechos: 0,
    };

    let plan;
    try {
      plan = planDevolucionVenta(datosNota, filas.map(partida), datos.lineas);
    } catch (err) {
      throw new ErrorHttp(400, err.message);
    }
    if (plan.devuelto > 0 && !datos.forma) throw new ErrorHttp(400, 'Elige cómo se devuelve el dinero');

    const creada = await ajustesRepo.insertarAjuste(db, e, {
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

    // Los puntos usados en lo devuelto regresan al cliente (antes de sumar lo devuelto a los renglones)
    await devolverCanjePorDevolucion(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      ventaId,
      lineas: plan.lineas.map((l) => ({ partidaId: l.partidaId, valor: l.valor })),
      clave: `canjedev:${datos.id}`,
      usuarioId: actor.id,
    });

    for (const l of plan.lineas) {
      await repo.registrarDevolucion(db, e, { ajusteId: datos.id, ventaId, partidaId: l.partidaId, cantidad: l.cantidad, valor: l.valor });
      if (!(await repo.sumarDevuelto(db, e, l.partidaId, l.cantidad, l.valor))) {
        throw new ErrorHttp(409, 'La venta cambió mientras se devolvía. Vuelve a intentarlo.');
      }
    }
    if (plan.devuelto > 0) {
      await ajustesRepo.insertarReembolso(db, e, {
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
    await ajustesRepo.sumarAjustes(db, e, ventaId, { cancelado: plan.cancelado, ajustado: 0, retenido: 0, reembolsado: plan.devuelto });

    // Lo devuelto deja de dar puntos
    await revertirSeguro(db, { empresaId: e, sucursalId: t.sucursal_id, ventaId, origen: 'venta', baseDevuelta: plan.cancelado, clave: `reversa:${datos.id}`, usuarioId: actor.id });

    // La bitácora nunca lleva PIN
    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: t.sucursal_id,
      usuarioId: actor.id,
      accion: 'venta.devolver',
      entidad: 'venta',
      entidadUuid: ventaId,
      antes: null,
      despues: {
        ajusteId: datos.id,
        lineas: plan.lineas.map((l) => ({ partidaId: l.partidaId, cantidad: l.cantidad, valor: l.valor })),
        devuelto: plan.devuelto,
        forma: plan.devuelto > 0 ? datos.forma : null,
        autorizadoPor: autorizo.id,
        motivo: datos.motivo,
      },
      ip,
    });

    return armarComprobante(db, e, [t.sucursal_id], ventaId, datos.id, false);
  });
}