import { pool } from '../config/db.js';
import { ErrorHttp } from './errores.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as configRepo from '../repositories/configuracion.repository.js';

// Mismas reglas que Promociones: una oferta para TODAS las sucursales exige acceso a todas
export async function contextoDeAlcance(actor) {
  const e = await empresas.obtener(pool, actor.empresaId);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  const activas = (await configRepo.listarSucursales(pool, actor.empresaId)).filter((s) => s.activo);
  const propias = activas.filter((s) => actor.sucursales.includes(s.id));
  if (!propias.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  return {
    e,
    activas,
    propias,
    propiasIds: propias.map((s) => s.id),
    puedeTodas: activas.every((s) => actor.sucursales.includes(s.id)),
  };
}

export const esVisible = (ctx, ids) => ids.length === 0 || ids.some((id) => ctx.propiasIds.includes(id));
export const puedeEditar = (ctx, ids) => (ids.length ? ids.every((id) => ctx.propiasIds.includes(id)) : ctx.puedeTodas);