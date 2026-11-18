import { calcularCorte } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/cortesLista.repository.js';
import * as corteRepo from '../repositories/corte.repository.js';
import * as movimientosRepo from '../repositories/movimientos.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as usuariosRepo from '../repositories/usuarios.repository.js';
import { movimiento } from '../serializers/movimientos.serializer.js';
import { corteLista, corteDetalle, corteEnCurso } from '../serializers/cortes.serializer.js';

// Solo cortes de las sucursales del usuario. El permiso caja.corte_completo lo exige la ruta.
export async function listar(actor, consulta) {
  const e = actor.empresaId;
  let sucursales = actor.sucursales;
  if (consulta.sucursalId) {
    if (!sucursales.includes(consulta.sucursalId)) throw new ErrorHttp(403, 'No tienes acceso a esa sucursal');
    sucursales = [consulta.sucursalId];
  }

  const [{ filas, total, resumen }, catalogo] = await Promise.all([
    repo.listar(pool, e, sucursales, consulta),
    usuariosRepo.listarSucursalesPorIds(pool, e, actor.sucursales),
  ]);
  return {
    datos: filas.map(corteLista),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
    resumen,
    sucursales: catalogo.map((s) => ({ id: s.id, nombre: s.nombre })),
  };
}

export async function obtener(actor, turnoId) {
  const e = actor.empresaId;
  const f = await repo.obtener(pool, e, actor.sucursales, turnoId);
  if (!f) throw new ErrorHttp(404, 'Corte no encontrado');

  const [movimientos, ajustes, ventas] = await Promise.all([
    movimientosRepo.listarDeTurno(pool, e, turnoId),
    repo.ajustesDeTurno(pool, e, turnoId),
    repo.ventasDeTurno(pool, e, turnoId),
  ]);
  return corteDetalle(f, movimientos.map(movimiento), ajustes, ventas);
}

// Cómo va un turno que sigue abierto. Nunca el turno propio: quien cuenta no debe ver lo esperado antes de contar.
export async function enCurso(actor, turnoId, ip) {
  const e = actor.empresaId;
  const t = await turnosRepo.obtenerTurno(pool, e, turnoId);
  if (!t || !actor.sucursales.includes(t.sucursal_id)) throw new ErrorHttp(404, 'Turno no encontrado');
  if (t.cerrado_en) throw new ErrorHttp(409, 'Ese turno ya se cerró. Búscalo en Cortes.');
  if (actor.id !== null && t.usuario_id === actor.id) {
    throw new ErrorHttp(403, 'No puedes ver cómo va tu propio turno: cuéntalo al hacer tu corte.');
  }

  const [sumas, movimientos, ajustes, ventas] = await Promise.all([
    corteRepo.sumarTurno(pool, e, turnoId),
    movimientosRepo.listarDeTurno(pool, e, turnoId),
    repo.ajustesDeTurno(pool, e, turnoId),
    repo.ventasDeTurno(pool, e, turnoId),
  ]);
  const calculo = calcularCorte({ fondo: t.fondo_inicial, ...sumas });

  await registrarBitacora(pool, {
    empresaId: e,
    sucursalId: t.sucursal_id,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion: 'turno.ver_en_curso',
    entidad: 'turno',
    entidadUuid: turnoId,
    antes: null,
    despues: { cajaId: t.caja_id, esperado: calculo.esperado },
    ip,
  });

  return corteEnCurso(t, calculo, movimientos.map(movimiento), ajustes, ventas);
}