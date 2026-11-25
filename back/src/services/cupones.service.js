import { randomBytes } from 'node:crypto';
import { codigoDesdeBytes, validarCupon } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { contextoDeAlcance as contexto, puedeEditar } from '../utils/alcanceSucursales.js';
import * as repo from '../repositories/cupones.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import { cupon as serializar } from '../serializers/cupones.serializer.js';

const sucursalIdsDe = (f) => (f.sucursal_ids ?? []).map(Number);
const autor = (actor) => ({ usuarioId: actor.id ?? null, adminGlobalId: actor.adminGlobalId ?? null });

const registrar = (db, actor, accion, id, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'cupon',
    entidadId: id,
    antes,
    despues,
    ip,
  });

const resumen = (d) => ({
  nombre: d.nombre,
  codigo: d.codigo,
  modo: d.modo,
  valor: d.valor,
  desde: d.desde,
  hasta: d.hasta,
  vecesPorCliente: d.vecesPorCliente,
  maxClientes: d.maxClientes,
  clienteId: d.clienteId,
  sucursalIds: d.sucursalIds,
});

function normalizar(datos) {
  const r = validarCupon(datos);
  if (!r.ok) throw new ErrorHttp(400, r.error);
  return r.valor;
}

const conCodigoUnico = (err) => (err.code === '23505' ? new ErrorHttp(409, 'Ya existe un cupón con ese código.') : err);

async function cargar(db, ctx, empresaId, id, opciones) {
  const fila = await repo.obtener(db, empresaId, id, opciones);
  const ids = fila ? sucursalIdsDe(fila) : [];
  const visible = ids.length === 0 || ids.some((s) => ctx.propiasIds.includes(s));
  if (!fila || !visible) throw new ErrorHttp(404, 'Cupón no encontrado');
  return { fila, sucursalIds: ids };
}

async function detalle(db, ctx, empresaId, id) {
  const { fila, sucursalIds } = await cargar(db, ctx, empresaId, id);
  return serializar(fila, { zona: ctx.e.zona_horaria, puedeEditar: puedeEditar(ctx, sucursalIds) });
}

function revisarSucursales(ctx, p) {
  const activas = ctx.activas.map((s) => s.id);
  if (p.sucursalIds.some((id) => !activas.includes(id))) throw new ErrorHttp(400, 'Hay una sucursal que no existe o está dada de baja.');
  if (!puedeEditar(ctx, p.sucursalIds)) {
    throw new ErrorHttp(
      403,
      p.sucursalIds.length
        ? 'Solo puedes usar tus sucursales.'
        : 'Para un cupón en todas las sucursales necesitas acceso a todas. Elige tus sucursales.'
    );
  }
}

async function codigoLibre(db, empresaId) {
  for (let i = 0; i < 10; i++) {
    const codigo = codigoDesdeBytes(randomBytes(8));
    if (!(await repo.existeCodigo(db, empresaId, codigo))) return codigo;
  }
  throw new ErrorHttp(500, 'No se pudo generar un código. Intenta de nuevo.');
}

// ---------- Consultas ----------
export async function listar(actor, consulta) {
  const ctx = await contexto(actor);
  const { filas, total } = await repo.listar(pool, actor.empresaId, ctx.propiasIds, consulta);
  return {
    datos: filas.map((f) => serializar(f, { zona: ctx.e.zona_horaria, puedeEditar: puedeEditar(ctx, sucursalIdsDe(f)) })),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
  };
}

export async function opciones(actor) {
  const ctx = await contexto(actor);
  return { puedeTodas: ctx.puedeTodas, sucursales: ctx.propias.map((s) => ({ id: s.id, nombre: s.nombre })) };
}

export async function obtener(actor, id) {
  const ctx = await contexto(actor);
  return detalle(pool, ctx, actor.empresaId, id);
}

// ---------- Cambios ----------
export async function crear(actor, datos, ip) {
  const ctx = await contexto(actor);
  const e = actor.empresaId;
  const p = normalizar(datos);
  try {
    return await conTransaccion(async (db) => {
      revisarSucursales(ctx, p);
      if (p.clienteId) {
        const cliente = await clientesRepo.obtener(db, e, p.clienteId);
        if (!cliente || !cliente.activo) throw new ErrorHttp(404, 'Cliente no encontrado');
      }
      let codigo = p.codigo;
      if (codigo) {
        if (await repo.existeCodigo(db, e, codigo)) throw new ErrorHttp(409, 'Ya existe un cupón con ese código.');
      } else {
        codigo = await codigoLibre(db, e);
      }
      const id = await repo.insertar(db, e, { ...p, codigo }, autor(actor));
      await repo.reemplazarSucursales(db, e, id, p.sucursalIds);
      await registrar(db, actor, 'cupon.crear', id, null, resumen({ ...p, codigo }), ip);
      return detalle(db, ctx, e, id);
    });
  } catch (err) {
    throw conCodigoUnico(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  const ctx = await contexto(actor);
  const e = actor.empresaId;
  return conTransaccion(async (db) => {
    const { fila, sucursalIds } = await cargar(db, ctx, e, id, { bloquear: true });
    if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de este cupón.');
    const p = normalizar({ ...datos, codigo: fila.codigo, clienteId: fila.cliente_id });
    if (p.maxClientes !== null && p.maxClientes < Number(fila.clientes_usados)) {
      throw new ErrorHttp(409, `Ya lo usaron ${fila.clientes_usados} clientes. El máximo no puede ser menor.`);
    }
    revisarSucursales(ctx, p);

    const antes = resumen({
      nombre: fila.nombre,
      codigo: fila.codigo,
      modo: fila.modo,
      valor: Number(fila.valor),
      desde: fila.desde,
      hasta: fila.hasta,
      vecesPorCliente: Number(fila.veces_por_cliente),
      maxClientes: fila.max_clientes === null ? null : Number(fila.max_clientes),
      clienteId: fila.cliente_id,
      sucursalIds,
    });
    await repo.actualizar(db, e, id, p);
    await repo.reemplazarSucursales(db, e, id, p.sucursalIds);
    await registrar(db, actor, 'cupon.editar', id, antes, resumen(p), ip);
    return detalle(db, ctx, e, id);
  });
}

export async function encender(actor, id, encendido, ip) {
  const ctx = await contexto(actor);
  const e = actor.empresaId;
  return conTransaccion(async (db) => {
    const { fila, sucursalIds } = await cargar(db, ctx, e, id, { bloquear: true });
    if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de este cupón.');
    if (fila.encendido === encendido) return detalle(db, ctx, e, id);
    await repo.cambiarEncendido(db, e, id, encendido);
    await registrar(db, actor, encendido ? 'cupon.encender' : 'cupon.apagar', id, { encendido: !encendido }, { encendido }, ip);
    return detalle(db, ctx, e, id);
  });
}

// Nunca se borra: queda dado de baja con motivo, fecha y quién
export async function darDeBaja(actor, id, motivo, ip) {
  const ctx = await contexto(actor);
  const e = actor.empresaId;
  return conTransaccion(async (db) => {
    const { fila, sucursalIds } = await cargar(db, ctx, e, id, { bloquear: true });
    if (!puedeEditar(ctx, sucursalIds)) throw new ErrorHttp(403, 'No tienes acceso a todas las sucursales de este cupón.');
    if (!(await repo.darDeBaja(db, e, id, motivo, autor(actor)))) throw new ErrorHttp(409, 'El cupón ya estaba dado de baja.');
    await registrar(db, actor, 'cupon.baja', id, { nombre: fila.nombre, codigo: fila.codigo }, { motivo }, ip);
    return { ok: true };
  });
}