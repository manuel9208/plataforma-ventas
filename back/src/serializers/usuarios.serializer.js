import { descifrar, enmascarar } from '../utils/cifrado.js';

const mascara = (cifrado) => {
  if (!cifrado) return null;
  try {
    return enmascarar(descifrar(cifrado));
  } catch {
    return '••••';
  }
};

// Nunca salen password_hash ni pin_hash. Los datos laborales salen enmascarados y solo con permiso.
export function serializarUsuario(f, { verDatos = false } = {}) {
  return {
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono,
    correo: f.correo,
    direccion: f.direccion,
    activo: f.activo,
    permisos: f.permisos,
    tienePin: f.tiene_pin,
    fechaIngreso: f.fecha_ingreso,
    fechaNacimiento: f.fecha_nacimiento,
    contactoEmergencia: {
      nombre: f.contacto_emergencia_nombre,
      telefono: f.contacto_emergencia_telefono,
    },
    rol: { id: f.rol_id, clave: f.rol_clave, nombre: f.rol_nombre, nivel: f.rol_nivel },
    sucursalIds: f.sucursal_ids,
    creadoEn: f.creado_en,
    datosLaborales: verDatos
      ? { rfc: mascara(f.rfc_cifrado), nss: mascara(f.nss_cifrado), curp: mascara(f.curp_cifrado) }
      : null,
  };
}