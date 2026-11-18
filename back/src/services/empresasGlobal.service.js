import bcrypt from 'bcryptjs';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { hashPin } from '../utils/pin.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { olvidarOrigenes } from '../utils/origenesPermitidos.js';
import * as admins from '../repositories/adminsGlobales.repository.js';
import * as repo from '../repositories/empresas.repository.js';
import * as alta from '../repositories/empresasAlta.repository.js';
import { empresaGlobal } from '../serializers/empresasGlobal.serializer.js';

// Lo hace todo en UNA transacción. La usan la pantalla y el comando npm run empresa:crear.
// datos ya viene validado con crearEmpresaBody.
export async function altaEmpresa(datos, { adminGlobalId = null, ip = null } = {}) {
  // Si el teléfono es de un administrador global, ese administrador nunca podría entrar (el login prueba primero al global)
  if (await admins.buscarParaLogin(pool, datos.admin.telefono)) {
    throw new ErrorHttp(409, 'Ese teléfono es de un administrador global. Usa otro para el administrador de la empresa.');
  }
  const [passwordHash, pinHash] = await Promise.all([bcrypt.hash(datos.admin.password, 12), hashPin(datos.admin.pin)]);

  try {
    const r = await conTransaccion(async (db) => {
      const empresaId = await alta.insertarEmpresa(db, datos);
      const roles = await alta.sembrarRoles(db, empresaId);
      const sucursalId = await alta.sembrarSucursal(db, empresaId, datos.sucursal);
      const usuarioId = await alta.insertarAdministrador(db, empresaId, {
        nombre: datos.admin.nombre,
        telefono: datos.admin.telefono,
        passwordHash,
        pinHash,
        rolId: roles.administrador,
      });
      await alta.asignarSucursal(db, empresaId, usuarioId, sucursalId);
      await alta.sembrarConfigEmpresa(db, empresaId);

      // La bitácora nunca lleva contraseñas ni PIN
      await registrarBitacora(db, {
        empresaId,
        adminGlobalId,
        accion: 'empresa.crear',
        entidad: 'empresa',
        entidadId: empresaId,
        despues: { slug: datos.slug, nombre: datos.nombre, tipoNegocio: datos.tipoNegocio, sucursal: datos.sucursal, dominios: datos.dominios },
        ip,
      });
      return { empresaId, sucursalId, usuarioId };
    });
    olvidarOrigenes();
    return r;
  } catch (err) {
    // En una empresa recién creada lo único que puede repetirse es el slug
    if (err.code === '23505') throw new ErrorHttp(409, 'Ya existe una empresa con ese slug. Elige otro.');
    throw err;
  }
}

export async function listar(consulta) {
  const { filas, total } = await repo.listar(pool, consulta);
  return { datos: filas.map(empresaGlobal), total, pagina: consulta.pagina, limite: consulta.limite };
}

export async function crear(actor, datos, ip) {
  const { empresaId, sucursalId } = await altaEmpresa(datos, { adminGlobalId: actor.adminGlobalId, ip });
  return { empresa: empresaGlobal(await repo.obtener(pool, empresaId)), sucursalId };
}

const cargarExistente = async (id) => {
  const e = await repo.obtener(pool, id);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  return e;
};

const bitacora = (db, actor, empresaId, accion, antes, despues, ip) =>
  registrarBitacora(db, {
    empresaId,
    adminGlobalId: actor.adminGlobalId,
    accion,
    entidad: 'empresa',
    entidadId: empresaId,
    antes,
    despues,
    ip,
  });

// El slug y el giro no se cambian: romperían el front y la configuración
export async function editar(actor, id, datos, ip) {
  const actual = await cargarExistente(id);

  // Cambiar de moneda con ventas ya registradas deja los montos sin sentido
  if (datos.moneda && datos.moneda !== actual.moneda && (await repo.tieneVentas(pool, id))) {
    throw new ErrorHttp(409, 'La moneda no se puede cambiar porque la empresa ya tiene ventas.');
  }

  const campos = {};
  if (datos.nombre !== undefined) campos.nombre = datos.nombre;
  if (datos.moneda !== undefined) campos.moneda = datos.moneda;
  if (datos.dominios !== undefined) campos.dominios_permitidos = datos.dominios;

  await conTransaccion(async (db) => {
    await repo.actualizar(db, id, campos);
    await bitacora(
      db,
      actor,
      id,
      'empresa.editar',
      { nombre: actual.nombre, moneda: actual.moneda, dominios: actual.dominios_permitidos },
      { nombre: datos.nombre, moneda: datos.moneda, dominios: datos.dominios },
      ip
    );
  });
  if (datos.dominios !== undefined) olvidarOrigenes();
  return empresaGlobal(await repo.obtener(pool, id));
}

export async function suspender(actor, id, motivo, ip) {
  const actual = await cargarExistente(id);
  if (actual.suspendida) throw new ErrorHttp(409, 'Esa empresa ya está suspendida');

  await conTransaccion(async (db) => {
    if (!(await repo.suspender(db, id, motivo, actor.adminGlobalId))) throw new ErrorHttp(409, 'Esa empresa ya está suspendida');
    await bitacora(db, actor, id, 'empresa.suspender', null, { motivo }, ip);
  });
  return empresaGlobal(await repo.obtener(pool, id));
}

export async function reactivar(actor, id, ip) {
  const actual = await cargarExistente(id);
  if (!actual.suspendida) throw new ErrorHttp(409, 'Esa empresa no está suspendida');

  await conTransaccion(async (db) => {
    if (!(await repo.reactivar(db, id))) throw new ErrorHttp(409, 'Esa empresa no está suspendida');
    await bitacora(db, actor, id, 'empresa.reactivar', { motivo: actual.suspension_motivo }, null, ip);
  });
  return empresaGlobal(await repo.obtener(pool, id));
}