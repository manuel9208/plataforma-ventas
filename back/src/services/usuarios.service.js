import bcrypt from 'bcryptjs';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { tienePermiso } from '../utils/permisos.js';
import { cifrar } from '../utils/cifrado.js';
import { hashPin } from '../utils/pin.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/usuarios.repository.js';
import { serializarUsuario } from '../serializers/usuarios.serializer.js';

const PERMISO_DATOS = 'empleados.datos_laborales';

// Campo de la API -> columna de la tabla
const CAMPOS_SIMPLES = {
  nombre: 'nombre',
  telefono: 'telefono',
  correo: 'correo',
  direccion: 'direccion',
  fechaIngreso: 'fecha_ingreso',
  fechaNacimiento: 'fecha_nacimiento',
  contactoEmergenciaNombre: 'contacto_emergencia_nombre',
  contactoEmergenciaTelefono: 'contacto_emergencia_telefono',
  activo: 'activo',
};

const alcanceDe = (actor) => ({ nivel: actor.nivel, sucursales: actor.sucursales });
const limpiarPermisos = (p = {}) => Object.fromEntries(Object.entries(p).filter(([, v]) => v === true));
const puedeVerDatos = (actor) => tienePermiso(actor.permisos, PERMISO_DATOS);
const salida = (actor, fila) => serializarUsuario(fila, { verDatos: puedeVerDatos(actor) });

// Solo roles de nivel estrictamente mayor al del actor
async function validarRol(db, actor, rolId) {
  const rol = await repo.buscarRol(db, actor.empresaId, rolId);
  if (!rol || !rol.activo || rol.nivel_jerarquico <= actor.nivel) {
    throw new ErrorHttp(403, 'No puedes asignar ese rol');
  }
}

// Solo sucursales que el actor también tiene
async function validarSucursales(db, actor, ids) {
  const unicas = [...new Set(ids)];
  if (!unicas.every((id) => actor.sucursales.includes(id))) {
    throw new ErrorHttp(403, 'No tienes acceso a una de las sucursales');
  }
  if ((await repo.contarSucursalesActivas(db, actor.empresaId, unicas)) !== unicas.length) {
    throw new ErrorHttp(400, 'Sucursal inválida');
  }
  return unicas;
}

// Anti-escalamiento: solo se otorgan permisos que el actor tiene (los ya existentes no cuentan)
function validarPermisos(actor, nuevos, actuales = {}) {
  for (const [clave, valor] of Object.entries(nuevos)) {
    if (valor === true && actuales[clave] !== true && !tienePermiso(actor.permisos, clave)) {
      throw new ErrorHttp(403, `No puedes otorgar el permiso ${clave}`);
    }
  }
}

// RFC, NSS y CURP: solo con permiso, y siempre cifrados
function prepararDatosLaborales(actor, d) {
  const cifrados = {};
  for (const k of ['rfc', 'nss', 'curp']) if (d[k]) cifrados[k] = cifrar(d[k]);
  if (Object.keys(cifrados).length && !puedeVerDatos(actor)) {
    throw new ErrorHttp(403, 'No tienes permiso para registrar datos laborales');
  }
  return cifrados;
}

function traducirDuplicado(err) {
  if (err.code !== '23505') return err;
  if (err.constraint === 'uq_usuarios_correo') return new ErrorHttp(409, 'Ese correo ya está registrado');
  return new ErrorHttp(409, 'Ese teléfono ya está registrado');
}

export async function obtenerOpciones(actor) {
  const [roles, sucursales] = await Promise.all([
    repo.listarRolesAsignables(pool, actor.empresaId, actor.nivel),
    repo.listarSucursalesPorIds(pool, actor.empresaId, actor.sucursales),
  ]);
  return {
    roles: roles.map((r) => ({ id: r.id, clave: r.clave, nombre: r.nombre, nivel: r.nivel_jerarquico })),
    sucursales,
  };
}

export async function listar(actor, consulta) {
  const { filas, total } = await repo.listar(pool, actor.empresaId, alcanceDe(actor), consulta);
  return { datos: filas.map((f) => salida(actor, f)), total, pagina: consulta.pagina, limite: consulta.limite };
}

export async function obtener(actor, id) {
  const fila = await repo.obtener(pool, actor.empresaId, alcanceDe(actor), id);
  if (!fila) throw new ErrorHttp(404, 'Usuario no encontrado');
  return salida(actor, fila);
}

export async function crear(actor, datos, ip) {
  const passwordHash = await bcrypt.hash(datos.password, 12);
  const pinHash = await hashPin(datos.pin);

  let creado;
  try {
    creado = await conTransaccion(async (db) => {
      await validarRol(db, actor, datos.rolId);
      const sucursales = await validarSucursales(db, actor, datos.sucursalIds);
      const permisos = limpiarPermisos(datos.permisos);
      validarPermisos(actor, permisos);
      const laborales = prepararDatosLaborales(actor, datos);

      const id = await repo.insertar(db, actor.empresaId, { ...datos, passwordHash, pinHash, permisos });
      await repo.insertarSucursales(db, actor.empresaId, id, sucursales);
      if (Object.keys(laborales).length) {
        await repo.guardarDatosLaborales(db, actor.empresaId, id, laborales);
      }

      const fila = await repo.obtener(db, actor.empresaId, alcanceDe(actor), id);
      await registrarBitacora(db, {
        empresaId: actor.empresaId,
        sucursalId: sucursales[0],
        usuarioId: actor.id,
        adminGlobalId: actor.adminGlobalId,
        accion: 'usuario.crear',
        entidad: 'usuario',
        entidadId: id,
        despues: {
          ...serializarUsuario(fila),
          ...(Object.keys(laborales).length ? { datosLaboralesRegistrados: true } : {}),
        },
        ip,
      });
      return fila;
    });
  } catch (err) {
    throw traducirDuplicado(err);
  }

  return salida(actor, creado);
}

export async function actualizar(actor, id, datos, ip) {
  const passwordHash = datos.password ? await bcrypt.hash(datos.password, 12) : null;
  const pinHash = datos.pin ? await hashPin(datos.pin) : null;

  let despues;
  try {
    despues = await conTransaccion(async (db) => {
      const antes = await repo.obtener(db, actor.empresaId, alcanceDe(actor), id);
      if (!antes) throw new ErrorHttp(404, 'Usuario no encontrado');

      const campos = {};
      for (const [campoApi, columna] of Object.entries(CAMPOS_SIMPLES)) {
        if (datos[campoApi] !== undefined) campos[columna] = datos[campoApi];
      }
      if (passwordHash) campos.password_hash = passwordHash;
      if (pinHash) campos.pin_hash = pinHash;
      if (datos.rolId !== undefined) {
        await validarRol(db, actor, datos.rolId);
        campos.rol_id = datos.rolId;
      }
      if (datos.permisos !== undefined) {
        const permisos = limpiarPermisos(datos.permisos);
        validarPermisos(actor, permisos, antes.permisos);
        campos.permisos = permisos;
      }
      const sucursales =
        datos.sucursalIds !== undefined ? await validarSucursales(db, actor, datos.sucursalIds) : null;
      const laborales = prepararDatosLaborales(actor, datos);
      const hayLaborales = Object.keys(laborales).length > 0;

      if (!Object.keys(campos).length && !sucursales && !hayLaborales) {
        throw new ErrorHttp(400, 'No hay cambios');
      }

      if (Object.keys(campos).length) await repo.actualizar(db, actor.empresaId, id, campos);
      if (sucursales) await repo.reemplazarSucursales(db, actor.empresaId, id, sucursales);
      if (hayLaborales) await repo.guardarDatosLaborales(db, actor.empresaId, id, laborales);

      const fila = await repo.obtener(db, actor.empresaId, alcanceDe(actor), id);

      let accion = 'usuario.editar';
      if (datos.activo === false && antes.activo) accion = 'usuario.desactivar';
      if (datos.activo === true && !antes.activo) accion = 'usuario.reactivar';

      await registrarBitacora(db, {
        empresaId: actor.empresaId,
        sucursalId: fila.sucursal_ids[0],
        usuarioId: actor.id,
        adminGlobalId: actor.adminGlobalId,
        accion,
        entidad: 'usuario',
        entidadId: id,
        antes: serializarUsuario(antes),
        despues: {
          ...serializarUsuario(fila),
          ...(passwordHash ? { passwordCambiada: true } : {}),
          ...(pinHash ? { pinCambiado: true } : {}),
          ...(hayLaborales ? { datosLaboralesActualizados: true } : {}),
        },
        ip,
      });
      return fila;
    });
  } catch (err) {
    throw traducirDuplicado(err);
  }

  return salida(actor, despues);
}

// Baja lógica: el usuario queda inactivo, no se borra
export const desactivar = (actor, id, ip) => actualizar(actor, id, { activo: false }, ip);