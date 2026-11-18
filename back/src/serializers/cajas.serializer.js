export const caja = (f) => ({
  id: f.id,
  sucursalId: f.sucursal_id,
  sucursal: f.sucursal_nombre,
  nombre: f.nombre,
  activo: f.activo,
  usuarios: f.usuarios,
  turnoAbierto: f.turno_abierto ? { usuario: f.turno_abierto.usuario, desde: f.turno_abierto.desde } : null,
});

export const usuarioAsignable = (f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, cajaId: f.caja_id });