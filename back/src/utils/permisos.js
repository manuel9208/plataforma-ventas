// "*" = todos los permisos (solo se asigna por script o SQL, nunca por la API)
export function tienePermiso(permisos, clave) {
  return permisos?.['*'] === true || permisos?.[clave] === true;
}