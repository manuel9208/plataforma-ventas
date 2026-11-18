export const sucursalGlobal = (s, zonaEmpresa) => ({
  id: s.id,
  nombre: s.nombre,
  direccion: s.direccion,
  zonaHoraria: s.zona_horaria ?? zonaEmpresa,
  zonaPropia: Boolean(s.zona_horaria),
  activo: s.activo,
  bajaMotivo: s.baja_motivo,
  bajaEn: s.baja_en,
  cajas: Number(s.cajas ?? 0),
  empleados: Number(s.empleados ?? 0),
});