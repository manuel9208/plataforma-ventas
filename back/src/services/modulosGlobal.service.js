import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { olvidarModulos } from '../utils/modulos.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as repo from '../repositories/modulos.repository.js';
import { modulosDeEmpresa } from '../serializers/modulosGlobal.serializer.js';

async function cargarEmpresa(id) {
  const e = await empresas.obtener(pool, id);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  return e;
}

export async function listar(empresaId) {
  await cargarEmpresa(empresaId);
  const [catalogo, deEmpresa, sucursales, hoy] = await Promise.all([
    repo.listarCatalogo(pool),
    repo.listarDeEmpresa(pool, empresaId),
    repo.sucursalesActivas(pool, empresaId),
    repo.hoyDeEmpresa(pool, empresaId),
  ]);
  return modulosDeEmpresa(catalogo, deEmpresa, sucursales, hoy);
}

export async function guardar(actor, empresaId, clave, datos, ip) {
  await cargarEmpresa(empresaId);
  const modulo = await repo.buscarModulo(pool, clave);
  if (!modulo) throw new ErrorHttp(404, 'Módulo no encontrado');
  // El sistema base es la mensualidad: no se apaga ni vence (solo se le puede poner precio)
  if (modulo.es_base && (!datos.activo || datos.venceEn)) {
    throw new ErrorHttp(409, 'El sistema base siempre está encendido y no tiene vencimiento.');
  }

  const antes = await repo.obtenerDeEmpresa(pool, empresaId, clave);
  await conTransaccion(async (db) => {
    await repo.guardarDeEmpresa(db, empresaId, clave, datos, actor.adminGlobalId);
    await registrarBitacora(db, {
      empresaId,
      adminGlobalId: actor.adminGlobalId,
      accion: 'modulo.guardar',
      entidad: 'modulo',
      antes: antes
        ? { modulo: clave, activo: antes.activo, precioPropio: antes.precio_propio === null ? null : Number(antes.precio_propio), venceEn: antes.vence_en, nota: antes.nota }
        : { modulo: clave, activo: false },
      despues: { modulo: clave, activo: datos.activo, precioPropio: datos.precioPropio, venceEn: datos.venceEn, nota: datos.nota },
      ip,
    });
  });
  olvidarModulos(empresaId);
  return listar(empresaId);
}