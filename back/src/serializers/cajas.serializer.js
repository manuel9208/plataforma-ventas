export const caja = (f) => ({
  id: f.id,
  sucursalId: f.sucursal_id,
  sucursal: f.sucursal_nombre,
  nombre: f.nombre,
  activo: f.activo,
  anchoPapel: f.ancho_papel,
  corteAutomatico: f.corte_automatico,
  abrirCajon: f.abrir_cajon,
  imprimirArea: f.imprimir_area,
  usuarios: f.usuarios,
  turnoAbierto: f.turno_abierto ? { usuario: f.turno_abierto.usuario, desde: f.turno_abierto.desde } : null,
});

export const usuarioAsignable = (f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, cajaId: f.caja_id });

// Lo que la Caja necesita para imprimir; sin caja asignada se usan los valores de siempre
export const impresionCaja = (f) => ({
  anchoPapel: f?.ancho_papel ?? 80,
  corteAutomatico: f?.corte_automatico ?? true,
  abrirCajon: f?.abrir_cajon ?? true,
  imprimirArea: f?.imprimir_area ?? true,
});