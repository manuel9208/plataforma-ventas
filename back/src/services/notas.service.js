import {
  aCentavos,
  aMonto,
  calcularLineaVenta,
  armarFolio,
  hoyEnZona,
  normalizarPagos,
  resolverPie,
  resumenNota,
  sumarDias,
  validarArticulo,
} from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { verificarPin } from '../utils/pin.js';
import * as repo from '../repositories/notasLista.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as notasRepo from '../repositories/notas.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as intentosRepo from '../repositories/intentos.repository.js';
import * as ajustesRepo from '../repositories/ajustes.repository.js';
import { notaLista, notaDetalle, reciboCobro } from '../serializers/notas.serializer.js';

const MAX_DIAS_PROMESA = 365;
const MAX_FALLOS_PIN = 5;
const VENTANA_PIN_MIN = 15;

const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};
const puedeGestionar = (actor) => tienePermiso(actor.permisos, 'notas.gestionar');
const puedeEditar = (actor) => tienePermiso(actor.permisos, 'notas.editar');
// Cotizar: AdminGlobal (0), Administrador (1) y Gerente (2), por nivel de rol
const NIVEL_MAX_COTIZAR = 2;
const puedeCotizar = (actor) => actor.esGlobal === true || (Number.isInteger(actor.nivel) && actor.nivel <= NIVEL_MAX_COTIZAR);

// Una nota entregada o cancelada solo la ve quien tiene notas.gestionar
function exigirVisible(actor, estado) {
  if ((estado === 'entregada' || estado === 'cancelada') && !puedeGestionar(actor)) {
    throw new ErrorHttp(403, 'Solo el gerente o el administrador pueden ver esa nota');
  }
}

const bitacora = (db, actor, accion, id, sucursalId, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    sucursalId,
    usuarioId: actor.id,
    accion,
    entidad: 'venta',
    entidadUuid: id,
    antes,
    despues,
    ip,
  });

export async function cargarDetalle(db, actor, id) {
  const v = await repo.obtener(db, actor.empresaId, actor.sucursales, id);
  if (!v || !v.tiene_servicios) return null;
  const e = actor.empresaId;
  const [productos, articulos, pagos, pies, config, vigentes, reembolsos] = await Promise.all([
    repo.listarProductos(db, e, id),
    repo.listarArticulos(db, e, id),
    repo.listarPagosConQuien(db, e, id),
    repo.cargarPies(db, e, v.sucursal_id),
    notasRepo.cargarConfig(db, e, v.sucursal_id),
    ajustesRepo.valoresVigentes(db, e, id),
    ajustesRepo.listarReembolsos(db, e, id),
  ]);
  const detalle = notaDetalle(v, productos, articulos, pagos, pies, { vigentes, reembolsos });
  detalle.pinEntregaActivo = config.pinEntregaActivo;
  detalle.puedeCotizar = puedeCotizar(actor);
  const datos = {
    empresa: v.empresa_nombre,
    sucursal: v.sucursal_nombre,
    direccion: v.sucursal_direccion,
    telefono_sucursal: v.sucursal_telefono,
  };
  // resolverPie devuelve una lista de líneas; el ticket las muestra como texto con saltos de línea
  detalle.pieRecepcion = resolverPie(pies.recepcion, datos).join('\n');
  detalle.pieEntrega = resolverPie(pies.entrega, datos).join('\n');
  return detalle;
}

// ---------- Lista ----------
// Cajero, auxiliar y jefe ven "por cobrar" y "por entregar"; entregadas y canceladas son de gerente y administrador
export async function listar(actor, consulta) {
  noGlobal(actor);
  const gestor = puedeGestionar(actor);
  if ((consulta.pestana === 'entregadas' || consulta.pestana === 'canceladas') && !gestor) {
    throw new ErrorHttp(403, 'Solo el gerente o el administrador pueden ver esas notas');
  }
  const [{ filas, total }, conteos] = await Promise.all([
    repo.listar(pool, actor.empresaId, actor.sucursales, consulta),
    repo.contar(pool, actor.empresaId, actor.sucursales, gestor, { fecha: consulta.fecha, atrasadas: consulta.atrasadas, cotizar: consulta.cotizar }),
  ]);
  return {
    datos: filas.map(notaLista),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
    conteos: Object.fromEntries(Object.entries(conteos).map(([k, n]) => [k, Number(n)])),
    puedeVerTodas: gestor,
  };
}

export async function obtener(actor, id) {
  noGlobal(actor);
  const d = await cargarDetalle(pool, actor, id);
  if (!d) throw new ErrorHttp(404, 'Nota no encontrada');
  exigirVisible(actor, d.estado);
  return { ...d, puedeGestionar: puedeGestionar(actor), puedeEditar: puedeEditar(actor) };
}

// ---------- Cobrar saldo ----------
export async function cobrar(actor, ventaId, datos, ip) {
  noGlobal(actor);
  const e = actor.empresaId;

  // Reintento de un cobro que ya se guardó: se devuelve el mismo recibo, sin cobrar de nuevo
  const previo = await repo.buscarCobro(pool, e, datos.id);
  if (previo) {
    if (previo.venta_id !== ventaId || previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Ese cobro ya existe');
    const nota = await cargarDetalle(pool, actor, ventaId);
    return { ...reciboCobro(nota, { creado_en: new Date() }, await repo.pagosDeCobro(pool, e, datos.id)), repetido: true };
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para cobrar');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  try {
    return await conTransaccion(async (db) => {
      const t = await ventasRepo.bloquearTurno(db, e, turno.id);
      if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
      if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

      // Solo se cobran notas de la misma sucursal del turno
      const venta = await repo.bloquearVenta(db, e, ventaId, [t.sucursal_id]);
      if (!venta || !venta.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');

      const actual = await cargarDetalle(db, { ...actor, sucursales: [t.sucursal_id] }, ventaId);
      exigirVisible(actor, actual?.estado);

      const saldo = resumenNota({
        total: venta.total,
        cancelado: venta.cancelado,
        ajustado: venta.ajustado,
        retenido: venta.retenido,
        reembolsado: venta.reembolsado,
        cobrado: await repo.totalPagado(db, e, ventaId),
      }).saldo;
      if (saldo <= 0) throw new ErrorHttp(409, 'Esta nota ya está pagada');

      let pagos;
      try {
        pagos = normalizarPagos(Math.min(saldo, datos.pagos.reduce((s, p) => s + p.monto, 0)), datos.pagos);
      } catch (err) {
        throw new ErrorHttp(400, err.message);
      }
      const monto = Number(pagos.reduce((s, p) => s + p.monto, 0).toFixed(2));
      if (monto > saldo) throw new ErrorHttp(400, `El pago supera el saldo de $${saldo.toFixed(2)}`);

      const creado = await repo.insertarCobro(db, e, { id: datos.id, ventaId, usuarioId: actor.id, turnoId: t.id, monto });
      if (!creado) throw new ErrorHttp(409, 'Ese cobro ya existe');
      await repo.insertarPagosDeCobro(db, e, { id: datos.id, ventaId, turnoId: t.id, cajaId: t.caja_id, usuarioId: actor.id }, pagos);

      await bitacora(db, actor, 'nota.cobrar', ventaId, t.sucursal_id, null, { monto, pagos: pagos.map((p) => ({ forma: p.forma, monto: p.monto })) }, ip);

      const nota = await cargarDetalle(db, { ...actor, sucursales: [t.sucursal_id] }, ventaId);
      return { ...reciboCobro(nota, { creado_en: new Date() }, await repo.pagosDeCobro(db, e, datos.id)), repetido: false };
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'venta_cobros_pkey') {
      const nota = await cargarDetalle(pool, actor, ventaId);
      return { ...reciboCobro(nota, { creado_en: new Date() }, await repo.pagosDeCobro(pool, e, datos.id)), repetido: true };
    }
    throw err;
  }
}

// ---------- Copia del ticket (sin PIN, siempre marcada como COPIA) ----------
export async function copia(actor, id, ip) {
  noGlobal(actor);
  const d = await cargarDetalle(pool, actor, id);
  if (!d) throw new ErrorHttp(404, 'Nota no encontrada');
  exigirVisible(actor, d.estado);
  await bitacora(pool, actor, 'nota.copia', id, d.sucursalId, null, { folio: d.folio }, ip);
  return { ...d, esCopia: true };
}

// ---------- Estado del trabajo: En espera / Listo ----------
export async function cambiarEstado(actor, ventaId, { estado, partidaIds, motivo }, ip) {
  noGlobal(actor);
  const e = actor.empresaId;
  const nuevo = estado === 'en_espera' ? 'recibido' : 'listo';

  return conTransaccion(async (db) => {
    const v = await repo.bloquearVenta(db, e, ventaId, actor.sucursales);
    if (!v || !v.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada');

    const filas = await repo.cargarPartidasEstado(db, e, ventaId);
    const elegidas = partidaIds ? filas.filter((f) => partidaIds.includes(f.partida_id)) : filas;
    if (partidaIds && elegidas.length !== partidaIds.length) throw new ErrorHttp(400, 'Hay un artículo que no pertenece a esta nota');

    const cambios = elegidas.filter((f) => f.estado_trabajo !== nuevo && !(nuevo === 'recibido' && f.estado_trabajo === 'en_proceso'));
    if (!cambios.length) throw new ErrorHttp(400, 'No hay nada que cambiar');

    for (const f of cambios) {
      // Un servicio por cotizar no puede quedar Listo hasta tener su precio
      if (nuevo === 'listo' && f.por_cotizar && !f.cotizado_en) {
        throw new ErrorHttp(409, 'Hay servicios por cotizar. Defínele el precio antes de marcarlo como listo.');
      }
      // Entregado y cancelado tienen su propio flujo (PIN del cliente y reembolso)
      if (f.estado_trabajo === 'entregado' || f.estado_trabajo === 'cancelado') {
        throw new ErrorHttp(409, 'Un artículo entregado o cancelado ya no se puede cambiar desde aquí');
      }
      // Regresar de "listo" a "en espera" es de gerente o administrador, con motivo
      if (f.estado_trabajo === 'listo' && nuevo === 'recibido') {
        if (!puedeGestionar(actor)) throw new ErrorHttp(403, 'Solo el gerente o el administrador pueden regresar un artículo a En espera');
        if (!motivo) throw new ErrorHttp(400, 'Escribe el motivo');
      }
    }

    for (const f of cambios) {
      await repo.cambiarEstado(db, e, f.partida_id, nuevo, actor.id);
      await repo.registrarCambioEstado(db, e, { partidaId: f.partida_id, anterior: f.estado_trabajo, nuevo, usuarioId: actor.id, motivo });
    }
    await bitacora(db, actor, 'nota.estado', ventaId, v.sucursal_id, null, { estado: nuevo, articulos: cambios.length, motivo: motivo ?? null }, ip);

    return { ...(await cargarDetalle(db, actor, ventaId)), puedeGestionar: puedeGestionar(actor), puedeEditar: puedeEditar(actor) };
  });
}

// ---------- Corrección de datos que no son dinero ----------
export async function corregir(actor, ventaId, datos, ip) {
  noGlobal(actor);
  if (!puedeEditar(actor)) throw new ErrorHttp(403, 'No tienes permiso para corregir notas');
  const e = actor.empresaId;

  // El PIN del empleado, con límite de intentos
  const clave = `pin:${actor.id}`;
  const fallos = await intentosRepo.contarFallos(pool, e, clave, '', VENTANA_PIN_MIN);
  if (fallos.porUsuario >= MAX_FALLOS_PIN) throw new ErrorHttp(429, 'Demasiados intentos con el PIN. Espera unos minutos.');
  const hash = await clientesPinHash(e, actor.id);
  if (!hash || !(await verificarPin(datos.pin, hash))) {
    await intentosRepo.registrarFallo(pool, e, clave, '');
    throw new ErrorHttp(403, 'PIN incorrecto');
  }
  await intentosRepo.limpiarFallos(pool, e, clave);

  return conTransaccion(async (db) => {
    const v = await repo.bloquearVenta(db, e, ventaId, actor.sucursales);
    if (!v || !v.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada');
    const antes = await repo.articulosDeVenta(db, e, ventaId);
    const porId = new Map(antes.map((a) => [a.partida_id, a]));
    const config = await notasRepo.cargarConfig(db, e, v.sucursal_id);
    const info = await repo.obtener(db, e, actor.sucursales, ventaId);
    const hoy = hoyEnZona(info.zona);

    const cambios = { articulos: [], cliente: null };

    for (const a of datos.articulos ?? []) {
      const previo = porId.get(a.partidaId);
      if (!previo) throw new ErrorHttp(400, 'Hay un artículo que no pertenece a esta nota');
      if (previo.estado_trabajo === 'entregado' || previo.estado_trabajo === 'cancelado') {
        throw new ErrorHttp(409, 'No se corrige un artículo entregado o cancelado');
      }
      const { datos: limpio, error } = validarArticulo(a, config.camposArticulo);
      if (error) throw new ErrorHttp(400, error);
      await repo.actualizarArticulo(db, e, a.partidaId, limpio);

      if (a.fechaPrometida) {
        if (a.fechaPrometida < hoy) throw new ErrorHttp(400, 'La fecha prometida no puede ser anterior a hoy');
        if (a.fechaPrometida > sumarDias(hoy, MAX_DIAS_PROMESA)) throw new ErrorHttp(400, 'La fecha prometida está demasiado lejos');
        await repo.actualizarFechaPrometida(db, e, a.partidaId, a.fechaPrometida);
      }
      cambios.articulos.push({
        partidaId: a.partidaId,
        antes: { marca: previo.marca, talla: previo.talla, color: previo.color, fecha: previo.fecha_prometida },
        despues: { ...limpio, fecha: a.fechaPrometida ?? previo.fecha_prometida },
      });
    }

    if (datos.cliente) {
      let clienteId = datos.cliente.clienteId ?? null;
      if (clienteId) {
        if (!(await ventasRepo.clienteActivo(db, e, clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');
      } else {
        const previoCli = await ventasRepo.buscarClientePorTelefono(db, e, datos.cliente.clienteNuevo.telefono);
        if (previoCli) {
          if (!previoCli.activo) throw new ErrorHttp(409, 'Ese teléfono pertenece a un cliente dado de baja');
          clienteId = previoCli.id;
        } else {
          clienteId = await clientesRepo.insertar(db, e, { ...datos.cliente.clienteNuevo, aceptaWhatsapp: false, usuarioId: actor.id });
        }
      }
      await repo.cambiarCliente(db, e, ventaId, clienteId);
      cambios.cliente = { antes: info.cliente_id, despues: clienteId };
    }

    // Todo cambio queda con motivo y con quién lo hizo. El dinero nunca se toca aquí.
    await bitacora(db, actor, 'nota.corregir', ventaId, v.sucursal_id, { motivo: datos.motivo }, cambios, ip);
    return { ...(await cargarDetalle(db, actor, ventaId)), puedeGestionar: puedeGestionar(actor), puedeEditar: puedeEditar(actor) };
  });
}

// ---------- Cotización: precio y fecha definitivos de los servicios "por cotizar" ----------
const cent = (v) => Math.round(aCentavos(Number(v ?? 0)));
const sumarImporte = (a, b) => (a == null || b == null ? null : aMonto(cent(a) + cent(b)));

export async function cotizar(actor, ventaId, { servicios }, ip) {
  if (!puedeCotizar(actor)) throw new ErrorHttp(403, 'Solo el administrador o el gerente pueden cotizar');
  const e = actor.empresaId;

  return conTransaccion(async (db) => {
    const v = await repo.bloquearVenta(db, e, ventaId, actor.sucursales);
    if (!v || !v.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada');
    const info = await repo.obtener(db, e, actor.sucursales, ventaId);
    const hoy = hoyEnZona(info.zona);
    const incluyeIva = info.precios_incluyen_iva; // el IVA se calcula como se creó la nota
    const config = await notasRepo.cargarConfig(db, e, v.sucursal_id);
    const porId = new Map((await repo.cargarParaCotizar(db, e, ventaId)).map((f) => [f.id, f]));

    let dTotal = 0;
    let dBase = 0;
    let dIva = 0;
    const antes = [];
    const despues = [];

    for (const s of servicios) {
      const f = porId.get(s.partidaId);
      if (!f) throw new ErrorHttp(400, 'Hay un servicio que no pertenece a esta nota');
      if (!f.por_cotizar) throw new ErrorHttp(400, 'Ese servicio tiene precio fijo: no se cotiza');
      if (f.estado_trabajo === 'entregado' || f.estado_trabajo === 'cancelado') {
        throw new ErrorHttp(409, 'Un servicio entregado o cancelado ya no se cotiza');
      }
      // Conservar la fecha que ya tenía siempre se permite (aunque ya haya pasado)
      if (s.fechaPrometida !== f.fecha_prometida && s.fechaPrometida < hoy) {
        throw new ErrorHttp(400, 'La fecha prometida no puede ser anterior a hoy');
      }
      if (s.fechaPrometida > sumarDias(hoy, MAX_DIAS_PROMESA)) throw new ErrorHttp(400, 'La fecha prometida está demasiado lejos');

      // Nota financiada: el cargo se fija al cotizar por primera vez y después se conserva
      const tasa = Number(f.tasa_iva);
      const primera = !f.cotizado_en;
      const cargoPrecio = primera ? (info.financiada ? config.financiamientoCargo : 0) : Number(f.cargo_financiamiento ?? 0);
      const principal = calcularLineaVenta({ precioBase: s.precio, mayoreo: [], cantidad: 1, tasa, incluyeIva });
      const cargo = cargoPrecio > 0 ? calcularLineaVenta({ precioBase: cargoPrecio, mayoreo: [], cantidad: 1, tasa, incluyeIva }) : null;

      const total = aMonto(cent(principal.total) + cent(cargo?.total));
      const base = sumarImporte(principal.subtotal, cargo ? cargo.subtotal : 0);
      const iva = sumarImporte(principal.iva, cargo ? cargo.iva : 0);

      dTotal += cent(total) - cent(f.total);
      if (base != null && f.base != null) dBase += cent(base) - cent(f.base);
      if (iva != null && f.iva != null) dIva += cent(iva) - cent(f.iva);

      await repo.aplicarCotizacion(db, e, {
        partidaId: f.id,
        precio: s.precio,
        base,
        iva,
        total,
        fecha: s.fechaPrometida,
        cargo: cargo ? cargo.total : 0,
        usuarioId: actor.id ?? null,
      });
      antes.push({ partidaId: f.id, precio: primera ? null : Number((Number(f.total) - Number(f.cargo_financiamiento ?? 0)).toFixed(2)), fecha: f.fecha_prometida });
      despues.push({ partidaId: f.id, precio: s.precio, fecha: s.fechaPrometida });
    }

    await repo.sumarTotalesVenta(db, e, ventaId, { total: aMonto(dTotal), subtotal: aMonto(dBase), iva: aMonto(dIva) });

    // Si el precio baja, el cliente no puede haber pagado más que lo que vale ahora la nota
    if (dTotal < 0) {
      const r = resumenNota({
        total: Number(v.total) + aMonto(dTotal),
        cancelado: v.cancelado,
        ajustado: v.ajustado,
        retenido: v.retenido,
        reembolsado: v.reembolsado,
        cobrado: await repo.totalPagado(db, e, ventaId),
      });
      if (r.pagado > r.total) throw new ErrorHttp(409, 'El cliente ya pagó más que el nuevo total. Haz primero un reembolso.');
    }

    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: v.sucursal_id,
      usuarioId: actor.id,
      adminGlobalId: actor.adminGlobalId,
      accion: 'nota.cotizar',
      entidad: 'venta',
      entidadUuid: ventaId,
      antes: { servicios: antes, total: Number(v.total) },
      despues: { servicios: despues, total: aMonto(cent(v.total) + dTotal) },
      ip,
    });

    return { ...(await cargarDetalle(db, actor, ventaId)), puedeGestionar: puedeGestionar(actor), puedeEditar: puedeEditar(actor) };
  });
}

async function clientesPinHash(empresaId, usuarioId) {
  const r = await pool.query(`SELECT pin_hash FROM usuarios WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, usuarioId]);
  return r.rows[0]?.pin_hash ?? null;
}

export { armarFolio };