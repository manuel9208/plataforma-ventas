export const cajaDeTurno = (t) => ({
  id: t.caja_id,
  nombre: t.caja_nombre,
  sucursalId: t.sucursal_id,
  sucursal: t.sucursal_nombre,
  zonaHoraria: t.zona,
});

export const turno = (t) => ({
  id: t.id,
  sucursalId: t.sucursal_id,
  sucursal: t.sucursal_nombre,
  caja: { id: t.caja_id, nombre: t.caja_nombre },
  usuario: { id: t.usuario_id, nombre: t.usuario_nombre },
  fondoInicial: Number(t.fondo_inicial),
  fechaOperativa: t.fecha_operativa,
  abiertoEn: t.abierto_en,
  cerradoEn: t.cerrado_en,
  cierreTardio: t.cierre_tardio,
  cierreFecha: t.cierre_fecha_local ?? null,
  vencido: t.cerrado_en ? false : Boolean(t.de_otro_dia),
  zonaHoraria: t.zona,
});