import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/catalogo.repository.js';
import * as ser from '../serializers/catalogo.serializer.js';

const META = {
  departamentos: { clave: 'departamento', serializar: ser.departamento, duplicado: 'Ya existe un departamento con ese nombre' },
  tiposArticulo: { clave: 'tipo_articulo', serializar: ser.tipoArticulo, duplicado: 'Ya existe un tipo de artículo con ese nombre' },
  tasasIva: { clave: 'tasa_iva', serializar: ser.tasaIva, duplicado: 'Ya existe una tasa con ese nombre' },
};

const registrar = (db, actor, accion, entidad, id, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId: actor.empresaId,
    usuarioId: actor.id,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad,
    entidadId: id,
    antes,
    despues,
    ip,
  });

async function protegido(entidad, fn) {
  try {
    return await fn();
  } catch (err) {
    throw err.code === '23505' ? new ErrorHttp(409, META[entidad].duplicado) : err;
  }
}

const crear = (actor, entidad, ip, insertar) =>
  protegido(entidad, () =>
    conTransaccion(async (db) => {
      const meta = META[entidad];
      const id = await insertar(db);
      const fila = await repo.obtener(db, actor.empresaId, entidad, id);
      await registrar(db, actor, `${meta.clave}.crear`, meta.clave, id, null, meta.serializar(fila), ip);
      return meta.serializar(fila);
    })
  );

// "preparar" valida las reglas propias y devuelve las columnas a cambiar
const editar = (actor, entidad, id, ip, preparar) =>
  protegido(entidad, () =>
    conTransaccion(async (db) => {
      const meta = META[entidad];
      const antes = await repo.obtener(db, actor.empresaId, entidad, id);
      if (!antes) throw new ErrorHttp(404, 'No encontrado');

      const campos = await preparar(db, antes);
      if (!Object.keys(campos).length) throw new ErrorHttp(400, 'No hay cambios');

      await repo.actualizar(db, actor.empresaId, entidad, id, campos);
      const despues = await repo.obtener(db, actor.empresaId, entidad, id);

      let accion = `${meta.clave}.editar`;
      if (antes.activo && !despues.activo) accion = `${meta.clave}.desactivar`;
      if (!antes.activo && despues.activo) accion = `${meta.clave}.reactivar`;

      await registrar(db, actor, accion, meta.clave, id, meta.serializar(antes), meta.serializar(despues), ip);
      return meta.serializar(despues);
    })
  );

export async function listar(actor, entidad, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, entidad, consulta);
  return { datos: filas.map(META[entidad].serializar), total, pagina: consulta.pagina, limite: consulta.limite };
}

// ---------- Departamentos ----------
export const crearDepartamento = (actor, datos, ip) =>
  crear(actor, 'departamentos', ip, async (db) => {
    await repo.bloquearEmpresa(db, actor.empresaId);
    const n = await repo.siguienteCodigoDepartamento(db, actor.empresaId);
    if (n > 99) throw new ErrorHttp(409, 'Se alcanzó el máximo de 99 departamentos');
    return repo.insertarDepartamento(db, actor.empresaId, {
      codigo: String(n).padStart(2, '0'),
      nombre: datos.nombre,
    });
  });

export const actualizarDepartamento = (actor, id, datos, ip) =>
  editar(actor, 'departamentos', id, ip, async (db, antes) => {
    const campos = {};
    if (datos.nombre !== undefined) campos.nombre = datos.nombre;
    if (datos.activo !== undefined) campos.activo = datos.activo;

    if (datos.activo === false && antes.activo) {
      const uso = await repo.contarUsoDepartamento(db, actor.empresaId, id);
      if (uso > 0) {
        throw new ErrorHttp(409, `No se puede desactivar: tiene ${uso} producto(s) o servicio(s) activos. Muévelos o dalos de baja primero.`);
      }
    }
    return campos;
  });

// ---------- Tipos de artículo ----------
export const crearTipoArticulo = (actor, datos, ip) =>
  crear(actor, 'tiposArticulo', ip, (db) => repo.insertarTipoArticulo(db, actor.empresaId, datos));

export const actualizarTipoArticulo = (actor, id, datos, ip) =>
  editar(actor, 'tiposArticulo', id, ip, async () => {
    const campos = {};
    if (datos.nombre !== undefined) campos.nombre = datos.nombre;
    if (datos.orden !== undefined) campos.orden = datos.orden;
    if (datos.activo !== undefined) campos.activo = datos.activo;
    return campos;
  });

// ---------- Tasas de IVA ----------
export const crearTasaIva = (actor, datos, ip) =>
  crear(actor, 'tasasIva', ip, (db) => repo.insertarTasaIva(db, actor.empresaId, datos));

export const actualizarTasaIva = (actor, id, datos, ip) =>
  editar(actor, 'tasasIva', id, ip, async (db, antes) => {
    const campos = {};
    if (datos.nombre !== undefined) campos.nombre = datos.nombre;
    if (datos.porcentaje !== undefined) campos.porcentaje = datos.porcentaje;
    if (datos.activo !== undefined) campos.activo = datos.activo;

    if (datos.activo === false && antes.activo) {
      if (antes.es_defecto) {
        throw new ErrorHttp(409, 'No puedes desactivar la tasa predeterminada. Marca otra como predeterminada primero.');
      }
      const uso = await repo.contarUsoTasa(db, actor.empresaId, id);
      if (uso > 0) {
        throw new ErrorHttp(409, `No se puede desactivar: la usan ${uso} producto(s), servicio(s) o extra(s) activos.`);
      }
    }

    if (datos.esDefecto === true) {
      const seguiraActiva = datos.activo ?? antes.activo;
      if (!seguiraActiva) throw new ErrorHttp(409, 'No puedes predeterminar una tasa inactiva');
      await repo.quitarTasaPredeterminada(db, actor.empresaId);
      campos.es_defecto = true;
    }
    return campos;
  });

// ---------- Configuración de la empresa ----------
export async function obtenerConfiguracion(actor) {
  return ser.config(await repo.obtenerConfig(pool, actor.empresaId));
}

export function actualizarConfiguracion(actor, datos, ip) {
  return conTransaccion(async (db) => {
    const antes = await repo.obtenerConfig(db, actor.empresaId);

    const campos = {};
    if (datos.preciosIncluyenIva !== undefined) campos.precios_incluyen_iva = datos.preciosIncluyenIva;
    if (datos.permitirVentaSinExistencia !== undefined) {
      campos.permitir_venta_sin_existencia = datos.permitirVentaSinExistencia;
    }
    if (!Object.keys(campos).length) throw new ErrorHttp(400, 'No hay cambios');

    await repo.actualizarConfig(db, actor.empresaId, campos);
    const despues = await repo.obtenerConfig(db, actor.empresaId);
    await registrar(db, actor, 'config.editar', 'empresa_config', actor.empresaId, ser.config(antes), ser.config(despues), ip);
    return ser.config(despues);
  });
}