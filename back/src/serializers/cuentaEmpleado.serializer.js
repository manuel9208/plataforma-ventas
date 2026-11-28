// Nunca salen password_hash ni pin_hash: solo si tiene PIN o no
export function serializarCuentaEmpleado(f, sucursales) {
  return {
    nombre: f.nombre,
    telefono: f.telefono,
    correo: f.correo ?? null,
    rol: f.rol_nombre,
    tienePin: Boolean(f.tiene_pin),
    sucursales: sucursales.map((s) => ({ id: Number(s.id), nombre: s.nombre })),
  };
}