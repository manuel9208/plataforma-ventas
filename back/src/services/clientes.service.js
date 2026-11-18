import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/clientes.repository.js';
import { serializarCliente } from '../serializers/clientes.serializer.js';

const traducir = (err) =>
  err.code === '23505' ? new ErrorHttp(409, 'Ya existe un cliente con ese teléfono') : err;

const bitacora = (db, actor, accion, id, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'cliente',
    entidadUuid: id,
    antes,
    despues,
    ip,
  });

export async function listar(actor, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, consulta);
  return { datos: filas.map(serializarCliente), total, pagina: consulta.pagina, limite: consulta.limite };
}

// La ficha completa queda en bitácora (la búsqueda de la lista no)
export async function obtener(actor, id, ip) {
  const fila = await repo.obtener(pool, actor.empresaId, id);
  if (!fila) throw new ErrorHttp(404, 'Cliente no encontrado');
  await bitacora(pool, actor, 'cliente.ver', id, null, null, ip);
  return serializarCliente(fila);
}

export async function crear(actor, datos, ip) {
  try {
    return await conTransaccion(async (db) => {
      const id = await repo.insertar(db, actor.empresaId, { ...datos, usuarioId: actor.id });
      const salida = serializarCliente(await repo.obtener(db, actor.empresaId, id));
      await bitacora(db, actor, 'cliente.crear', id, null, salida, ip);
      return salida;
    });
  } catch (err) {
    throw traducir(err);
  }
}

export async function actualizar(actor, id, datos, ip) {
  try {
    return await conTransaccion(async (db) => {
      const antesFila = await repo.obtener(db, actor.empresaId, id);
      if (!antesFila) throw new ErrorHttp(404, 'Cliente no encontrado');

      const campos = {};
      for (const k of ['nombre', 'telefono', 'correo', 'notas', 'activo']) {
        if (datos[k] !== undefined) campos[k] = datos[k];
      }
      // El consentimiento guarda la fecha en que se dio
      if (datos.aceptaWhatsapp !== undefined && datos.aceptaWhatsapp !== antesFila.acepta_whatsapp) {
        campos.acepta_whatsapp = datos.aceptaWhatsapp;
        campos.consentimiento_whatsapp_en = datos.aceptaWhatsapp ? new Date() : null;
      }
      if (!Object.keys(campos).length) throw new ErrorHttp(400, 'No hay cambios');

      await repo.actualizar(db, actor.empresaId, id, campos);
      const antes = serializarCliente(antesFila);
      const despues = serializarCliente(await repo.obtener(db, actor.empresaId, id));

      let accion = 'cliente.editar';
      if (antes.activo && !despues.activo) accion = 'cliente.desactivar';
      if (!antes.activo && despues.activo) accion = 'cliente.reactivar';
      await bitacora(db, actor, accion, id, antes, despues, ip);
      return despues;
    });
  } catch (err) {
    throw traducir(err);
  }
}