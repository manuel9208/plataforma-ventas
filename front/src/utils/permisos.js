export const ROLES_ADMIN = ['adminglobal', 'administrador', 'gerente'];
export const ROLES_GESTION = ['administrador', 'gerente'];
export const TODOS_LOS_ROLES = ['administrador', 'gerente', 'jefe', 'cajero', 'auxiliar'];

// "*" = todos los permisos
export const tienePermiso = (permisos, clave) => permisos?.['*'] === true || permisos?.[clave] === true;

// Pantallas principales. El orden decide a cuál entra primero quien tiene varias.
export const PANTALLAS = [
  { id: 'admin', ruta: '/admin', permiso: 'pantalla.admin', roles: ROLES_ADMIN },
  { id: 'caja', ruta: '/caja', permiso: 'pantalla.caja', roles: TODOS_LOS_ROLES },
];

export const pantallasDe = (usuario) =>
  PANTALLAS.filter((p) => p.roles.includes(usuario.rol) && tienePermiso(usuario.permisos, p.permiso));

export const puedeEntrarA = (usuario, id) => pantallasDe(usuario).some((p) => p.id === id);

export const rutaInicio = (usuario) => (pantallasDe(usuario).length ? '/panel' : '/');

// Si se marca un permiso que necesita una pantalla (por ejemplo "requiere: pantalla.admin"), la pantalla se agrega sola.
export function conPantallas(permisos, catalogo) {
  const resultado = { ...permisos };
  for (const p of catalogo) {
    if (resultado[p.clave] === true && p.requiere) resultado[p.requiere] = true;
  }
  return resultado;
}