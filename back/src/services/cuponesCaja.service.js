import { hoyEnZona, motivoCuponNoUsable, normalizarCodigo, resolverCupon } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { moduloActivo } from '../utils/modulos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { limitarIntentos } from './autorizacion.service.js';
import { contextoDelTurno } from './cajaCatalogo.service.js';
import * as repo from '../repositories/cupones.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as intentosRepo from '../repositories/intentos.repository.js';
import { cuponParaCalculo } from '../serializers/cupones.serializer.js';

// Antes de la transacción (los intentos fallidos se guardan aparte y no se deshacen).
// Cualquier rechazo cuenta como intento: así nadie puede ir probando códigos.
// c: { sucursalId, hoy, clienteId, codigo }
export async function verificarCupon(actor, c) {
  const e = actor.empresaId;
  if (!(await moduloActivo(e, 'promociones'))) throw new ErrorHttp(403, 'Este módulo no está activo en tu plan');
  if (!c.clienteId) throw new ErrorHttp(400, 'Para usar un cupón elige al cliente registrado.');

  const clave = `cupon:${actor.id}`;
  await limitarIntentos(e, clave, 'Demasiados códigos incorrectos. Espera unos minutos.');
  const rechazar = async (estado, mensaje) => {
    await intentosRepo.registrarFallo(pool, e, clave, '');
    throw new ErrorHttp(estado, mensaje);
  };

  const cliente = await clientesRepo.obtener(pool, e, c.clienteId);
  if (!cliente || !cliente.activo) throw new ErrorHttp(404, 'Cliente no encontrado');

  const fila = await repo.buscarPorCodigo(pool, e, normalizarCodigo(c.codigo));
  if (!fila) return rechazar(404, 'No encontramos ese cupón. Revisa el código.');

  const cupon = cuponParaCalculo(fila);
  const usos = await repo.usosDe(pool, e, cupon.id, c.clienteId);
  const motivo = motivoCuponNoUsable(cupon, { hoy: c.hoy, sucursalId: c.sucursalId, clienteId: c.clienteId, ...usos });
  if (motivo) return rechazar(409, motivo);
  return cupon;
}

// Lo que la Caja necesita para mostrar el descuento (el servidor vuelve a calcular todo al cobrar)
export async function consultarCupon(actor, { codigo, clienteId }) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
  const { sucursalId, zona } = await contextoDelTurno(actor);
  const c = await verificarCupon(actor, { sucursalId, hoy: hoyEnZona(zona), clienteId, codigo });
  return { id: c.id, codigo: c.codigo, nombre: c.nombre, modo: c.modo, valor: c.valor };
}

// Dentro de la transacción: bloquea el cupón, revisa sus límites con el uso real y rebaja las partidas.
// c: { empresaId, sucursalId, hoy, clienteId, cuponId, productos, servicios, incluyeIva }
export async function aplicarCupon(db, c) {
  const e = c.empresaId;
  const fila = await repo.buscarPorId(db, e, c.cuponId, { bloquear: true });
  if (!fila) throw new ErrorHttp(409, 'Ese cupón ya no está disponible.');
  const cupon = cuponParaCalculo(fila);

  const usos = await repo.usosDe(db, e, cupon.id, c.clienteId);
  const motivo = motivoCuponNoUsable(cupon, { hoy: c.hoy, sucursalId: c.sucursalId, clienteId: c.clienteId, ...usos });
  if (motivo) throw new ErrorHttp(409, motivo);

  const r = resolverCupon({ cupon, productos: c.productos, servicios: c.servicios, incluyeIva: c.incluyeIva });
  if (!r.ok) throw new ErrorHttp(409, r.error);
  return { productos: r.productos, servicios: r.servicios, cupon: { id: cupon.id, codigo: cupon.codigo, descuento: r.descuento } };
}

// Se anota junto con la venta: si algo falla, todo se deshace
export async function registrarUsoCupon(db, p) {
  await repo.insertarUso(db, p.empresaId, {
    cuponId: p.cupon.id,
    clienteId: p.clienteId,
    ventaId: p.ventaId,
    sucursalId: p.sucursalId,
    descuento: p.cupon.descuento,
    usuarioId: p.usuarioId,
  });
  await registrarBitacora(db, {
    empresaId: p.empresaId,
    sucursalId: p.sucursalId,
    usuarioId: p.usuarioId,
    accion: 'cupon.usar',
    entidad: 'cupon',
    entidadId: p.cupon.id,
    despues: { codigo: p.cupon.codigo, ventaId: p.ventaId, descuento: p.cupon.descuento },
  });
}

// Si la nota o venta quedó cancelada completa, el cupón vuelve a quedar libre para ese cliente
export async function liberarCuponSiCancelada(db, { empresaId, sucursalId, ventaId, usuarioId }) {
  const n = await repo.liberarDeVenta(db, empresaId, ventaId);
  if (n > 0) {
    await registrarBitacora(db, {
      empresaId,
      sucursalId,
      usuarioId,
      accion: 'cupon.liberar',
      entidad: 'venta',
      entidadUuid: ventaId,
      despues: { motivo: 'La nota se canceló completa' },
    });
  }
}