import { calcularCorte, evaluarConteo, validarConteo } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/turnos.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as corteRepo from '../repositories/corte.repository.js';
import * as ser from '../serializers/turnos.serializer.js';
import { corteCiego, corteDetallado } from '../serializers/corte.serializer.js';

// El administrador global nunca opera caja
const noGlobal = (actor) => {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
};

const cajaDe = (c) => ({
  id: c.caja_id,
  nombre: c.caja_nombre,
  sucursalId: c.sucursal_id,
  sucursal: c.sucursal_nombre,
  zonaHoraria: c.zona,
});

// Lo que la pantalla de Caja necesita saber al entrar
export async function estadoActual(actor, db = pool) {
  noGlobal(actor);
  const e = actor.empresaId;

  const abierto = await repo.turnoAbiertoDeUsuario(db, e, actor.id);
  if (abierto) {
    return {
      estado: 'turno_abierto',
      caja: ser.cajaDeTurno(abierto),
      turno: ser.turno(abierto),
      turnoVencido: Boolean(abierto.de_otro_dia),
      fondoSugerido: null,
      ocupadaPor: null,
    };
  }

  const base = { turno: null, turnoVencido: false, fondoSugerido: null, ocupadaPor: null };
  const caja = await repo.cajaAsignada(db, e, actor.id);
  if (!caja || !actor.sucursales.includes(caja.sucursal_id)) return { estado: 'sin_caja', caja: null, ...base };
  if (!caja.caja_activa || !caja.sucursal_activa) return { estado: 'caja_inactiva', caja: cajaDe(caja), ...base };

  const ocupante = await repo.turnoAbiertoDeCaja(db, e, caja.caja_id);
  if (ocupante) {
    return {
      estado: 'caja_ocupada',
      caja: cajaDe(caja),
      ...base,
      turnoVencido: Boolean(ocupante.de_otro_dia),
      ocupadaPor: {
        usuario: ocupante.usuario_nombre,
        desde: ocupante.abierto_en,
        fechaOperativa: ocupante.fecha_operativa,
      },
    };
  }

  return { estado: 'sin_turno', caja: cajaDe(caja), ...base, fondoSugerido: await repo.ultimoDejado(db, e, caja.caja_id) };
}

export async function abrir(actor, { fondoInicial }, ip) {
  noGlobal(actor);
  const e = actor.empresaId;

  try {
    await conTransaccion(async (db) => {
      if (await repo.turnoAbiertoDeUsuario(db, e, actor.id)) throw new ErrorHttp(409, 'Ya tienes un turno abierto');

      const caja = await repo.cajaAsignada(db, e, actor.id);
      if (!caja) throw new ErrorHttp(409, 'Aún no tienes una caja asignada. Pídele a tu gerente que te asigne una.');
      if (!caja.caja_activa || !caja.sucursal_activa) {
        throw new ErrorHttp(409, 'Tu caja está desactivada. Avisa a tu gerente.');
      }
      if (!actor.sucursales.includes(caja.sucursal_id)) {
        throw new ErrorHttp(403, 'No tienes acceso a la sucursal de tu caja');
      }

      const ocupante = await repo.turnoAbiertoDeCaja(db, e, caja.caja_id);
      if (ocupante) {
        throw new ErrorHttp(409, `Esta caja la tiene abierta ${ocupante.usuario_nombre}. Pídele que cierre su turno.`);
      }

      const id = await repo.insertarTurno(db, e, {
        sucursalId: caja.sucursal_id,
        cajaId: caja.caja_id,
        usuarioId: actor.id,
        fondoInicial,
        zona: caja.zona,
      });
      const t = await repo.obtenerTurno(db, e, id);
      await registrarBitacora(db, {
        empresaId: e,
        sucursalId: caja.sucursal_id,
        usuarioId: actor.id,
        accion: 'turno.abrir',
        entidad: 'turno',
        entidadUuid: id,
        despues: { cajaId: caja.caja_id, fondoInicial, fechaOperativa: t.fecha_operativa },
        ip,
      });
    });
  } catch (err) {
    // Los índices de la base impiden dos turnos abiertos aunque dos personas abran al mismo tiempo
    if (err.code === '23505') {
      throw new ErrorHttp(
        409,
        err.constraint === 'uq_turno_abierto_usuario' ? 'Ya tienes un turno abierto' : 'Esta caja ya tiene un turno abierto'
      );
    }
    throw err;
  }
  return estadoActual(actor);
}

// Corte y cierre. Lo hace su dueño o quien tiene caja.administrar en esa sucursal, y cuenta el efectivo.
// El administrador global puede cerrar un turno olvidado sin conteo.
export async function cerrar(actor, turnoId, datos = {}, ip) {
  const e = actor.empresaId;
  const global = Boolean(actor.esGlobal);

  let conteo = null;
  if (!global) {
    if (datos.efectivoContado === undefined || datos.dejadoManana === undefined) {
      throw new ErrorHttp(400, 'Cuenta el efectivo de la caja y escribe cuánto dejas para mañana');
    }
    try {
      conteo = validarConteo({ contado: datos.efectivoContado, dejado: datos.dejadoManana });
    } catch (err) {
      throw new ErrorHttp(400, err.message);
    }
  }

  return conTransaccion(async (db) => {
    // El turno se bloquea: mientras se hace el corte nadie puede vender ni cobrar en él
    const bloqueado = await ventasRepo.bloquearTurno(db, e, turnoId);
    if (!bloqueado) throw new ErrorHttp(404, 'Turno no encontrado');
    if (bloqueado.cerrado_en) throw new ErrorHttp(409, 'Ese turno ya está cerrado');

    const antes = await repo.obtenerTurno(db, e, turnoId);

    const esDueno = actor.id !== null && antes.usuario_id === actor.id;
    const esSupervisor =
      (global || tienePermiso(actor.permisos, 'caja.administrar')) && actor.sucursales.includes(antes.sucursal_id);
    if (!esDueno && !esSupervisor) throw new ErrorHttp(403, 'No puedes cerrar este turno');

    const sumas = await corteRepo.sumarTurno(db, e, turnoId);
    const calculo = calcularCorte({ fondo: antes.fondo_inicial, ...sumas });
    const evaluacion = conteo ? evaluarConteo({ esperado: calculo.esperado, contado: conteo.contado }) : null;

    const cerrado = await repo.cerrarTurno(db, e, turnoId, actor.id ?? null, actor.adminGlobalId ?? null, conteo ?? {});
    if (!cerrado) throw new ErrorHttp(409, 'Ese turno ya está cerrado');

    await corteRepo.insertarCorte(db, e, {
      turnoId,
      sucursalId: antes.sucursal_id,
      cajaId: antes.caja_id,
      sinConteo: !conteo,
      calculo,
      conteo,
      evaluacion,
    });

    const despues = ser.turno(await repo.obtenerTurno(db, e, turnoId));
    await registrarBitacora(db, {
      empresaId: e,
      sucursalId: antes.sucursal_id,
      usuarioId: actor.id,
      adminGlobalId: actor.adminGlobalId,
      accion: 'turno.cerrar',
      entidad: 'turno',
      entidadUuid: turnoId,
      antes: { abiertoPor: antes.usuario_id, fechaOperativa: antes.fecha_operativa },
      despues: {
        cierreTardio: despues.cierreTardio,
        fechaOperativa: despues.fechaOperativa,
        cierreFecha: despues.cierreFecha,
        sinConteo: !conteo,
        esperado: calculo.esperado,
        contado: conteo?.contado ?? null,
        diferencia: evaluacion?.diferencia ?? null,
        dejado: conteo?.dejado ?? null,
        entregado: conteo?.entregado ?? null,
      },
      ip,
    });

    // Quien hace el corte ciego solo ve lo que entrega; el detalle es de gerente, administrador y AdminGlobal
    const detallado = global || tienePermiso(actor.permisos, 'caja.corte_completo');
    return { ...despues, corte: detallado ? corteDetallado(calculo, conteo, evaluacion) : corteCiego(conteo) };
  });
}

// Para que un gerente vea y cierre los turnos olvidados
export async function listarAbiertos(actor) {
  const filas = await repo.listarAbiertos(pool, actor.empresaId, actor.sucursales);
  return filas.map(ser.turno);
}