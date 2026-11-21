import { valorPuntos } from '@plataforma/calculos';

export const movimiento = (f) => ({
  id: f.id,
  tipo: f.tipo,
  origen: f.origen,
  puntos: Number(f.puntos),
  motivo: f.motivo,
  venceEn: f.vence_en,
  creadoEn: f.creado_en,
  fecha: f.fecha,
  folio: f.folio ?? null,
});

export const resumen = ({ saldo, porVencer, vencidos }, cfg, movimientos, activo) => ({
  activo,
  saldo,
  valor: valorPuntos(saldo, cfg.valor),
  valorPunto: cfg.valor,
  porVencer,
  vencidos,
  movimientos: movimientos.map(movimiento),
});