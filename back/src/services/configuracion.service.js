import { ajustesVisibles, queSeVende, validarAjuste } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as repo from '../repositories/configuracion.repository.js';
import * as sucursalesRepo from '../repositories/sucursalesGlobal.repository.js';
import { vistaConfiguracion } from '../serializers/configuracion.serializer.js';

// Quién puede qué: los ajustes de TODA la empresa solo con acceso a todas las sucursales activas
async function contexto(actor, sucursalId) {
  const e = await empresas.obtener(pool, actor.empresaId);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  const activas = (await repo.listarSucursales(pool, actor.empresaId)).filter((s) => s.activo);
  const propias = activas.filter((s) => actor.sucursales.includes(s.id));
  if (!propias.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  const puedeEmpresa = activas.every((s) => actor.sucursales.includes(s.id));
  if (sucursalId && !propias.some((s) => s.id === sucursalId)) throw new ErrorHttp(403, 'No tienes acceso a esa sucursal');
  return { e, propias, puedeEmpresa };
}

export async function obtener(actor, sucursalPedida) {
  const { e, propias, puedeEmpresa } = await contexto(actor, sucursalPedida);
  // Sin acceso a todas las sucursales no hay "toda la empresa": se abre la primera sucursal propia
  const alcance = sucursalPedida ?? (puedeEmpresa ? null : propias[0].id);
  const cfg = await repo.leerConfig(pool, actor.empresaId, alcance);
  const sucursal = alcance ? propias.find((s) => s.id === alcance) : null;
  return vistaConfiguracion({ empresa: e, sucursales: propias, alcance, puedeEmpresa, cfg, sucursal });
}

export async function guardarAjustes(actor, sucursalId, valores, ip) {
  const { e, puedeEmpresa } = await contexto(actor, sucursalId);
  if (!sucursalId && !puedeEmpresa) {
    throw new ErrorHttp(403, 'Para cambiar los ajustes de toda la empresa necesitas acceso a todas las sucursales. Elige tu sucursal.');
  }

  const permitidos = new Map(
    ajustesVisibles(e.tipo_negocio)
      .filter((a) => !sucursalId || a.nivel === 'ambos')
      .map((a) => [a.clave, a])
  );

  const porClave = {};
  for (const [clave, bruto] of Object.entries(valores)) {
    const def = permitidos.get(clave);
    if (!def) throw new ErrorHttp(400, 'Ese ajuste no existe o no aplica a este tipo de negocio');
    if (bruto === null) {
      if (!sucursalId) throw new ErrorHttp(400, `${def.etiqueta}: no se puede dejar vacío para toda la empresa`);
      porClave[clave] = null;
    } else {
      const r = validarAjuste(def, bruto);
      if (!r.ok) throw new ErrorHttp(400, r.error);
      porClave[clave] = r.valor;
    }
  }

  const antes = await repo.leerConfig(pool, actor.empresaId, sucursalId ?? null);
  const nuevo = { empresa: { ...antes.empresa }, sucursal: { ...antes.sucursal } };
  Object.assign(sucursalId ? nuevo.sucursal : nuevo.empresa, porClave);

  // Siempre debe quedar algo a la venta
  const vende = queSeVende({ giro: e.tipo_negocio, empresa: nuevo.empresa, sucursal: sucursalId ? nuevo.sucursal : {} });
  if (!vende.vendeProductos && !vende.vendeServicios) throw new ErrorHttp(409, 'Debes vender al menos productos o servicios.');

  const previo = sucursalId ? antes.sucursal : antes.empresa;
  await conTransaccion(async (db) => {
    if (sucursalId) await repo.guardarConfigSucursal(db, actor.empresaId, sucursalId, porClave);
    else await repo.guardarConfigEmpresa(db, actor.empresaId, porClave);
    await registrarBitacora(db, {
      empresaId: actor.empresaId,
      sucursalId: sucursalId ?? null,
      usuarioId: actor.id,
      adminGlobalId: actor.adminGlobalId,
      accion: 'configuracion.guardar',
      entidad: 'configuracion',
      antes: Object.fromEntries(Object.keys(porClave).map((k) => [k, previo[k]])),
      despues: porClave,
      ip,
    });
  });
  return obtener(actor, sucursalId);
}

export async function guardarSucursal(actor, id, datos, ip) {
  const { e, propias, puedeEmpresa } = await contexto(actor, id);
  const actual = propias.find((s) => s.id === id);

  const campos = {};
  if (datos.nombre !== undefined) campos.nombre = datos.nombre;
  if (datos.telefono !== undefined) campos.telefono = datos.telefono;
  if (datos.direccion !== undefined) campos.direccion = datos.direccion;
  if (datos.referencias !== undefined) campos.referencias = datos.referencias;
  if (datos.mapaUrl !== undefined) campos.mapa_url = datos.mapaUrl;
  if (datos.lat !== undefined) {
    campos.lat = datos.lat === null ? null : Number(datos.lat.toFixed(6));
    campos.lon = datos.lon === null ? null : Number(datos.lon.toFixed(6));
  }
  if (datos.zonaHoraria !== undefined) {
    // Si es la misma de la empresa no se guarda una propia: sigue a la empresa
    const nueva = datos.zonaHoraria !== e.zona_horaria ? datos.zonaHoraria : null;
    if (nueva !== actual.zona_horaria) {
      // Con un turno abierto, cambiar la zona movería la fecha operativa de ese turno
      if ((await sucursalesRepo.turnosAbiertos(pool, actor.empresaId, id)) > 0) {
        throw new ErrorHttp(409, 'No se puede cambiar la zona horaria mientras haya un turno abierto en esta sucursal.');
      }
      campos.zona_horaria = nueva;
    }
  }
  if (datos.esPrincipal && !puedeEmpresa) {
    throw new ErrorHttp(403, 'Solo quien tiene acceso a todas las sucursales puede elegir la sucursal principal.');
  }
  const cambiaPrincipal = datos.esPrincipal === true && !actual.es_principal;
  if (!Object.keys(campos).length && !cambiaPrincipal) throw new ErrorHttp(400, 'No hay cambios que guardar');

  try {
    await conTransaccion(async (db) => {
      if (Object.keys(campos).length) await repo.actualizarSucursal(db, actor.empresaId, id, campos);
      if (cambiaPrincipal) await repo.marcarPrincipal(db, actor.empresaId, id);
      await registrarBitacora(db, {
        empresaId: actor.empresaId,
        sucursalId: id,
        usuarioId: actor.id,
        adminGlobalId: actor.adminGlobalId,
        accion: 'sucursal.configurar',
        entidad: 'sucursal',
        entidadId: id,
        antes: Object.fromEntries(Object.keys(campos).map((k) => [k, actual[k]])),
        despues: { ...campos, ...(cambiaPrincipal ? { es_principal: true } : {}) },
        ip,
      });
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new ErrorHttp(
        409,
        err.constraint === 'uq_sucursal_principal' ? 'Se estaba cambiando la sucursal principal. Intenta de nuevo.' : 'Ya existe una sucursal con ese nombre.'
      );
    }
    throw err;
  }
  return obtener(actor, id);
}