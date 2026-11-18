import { calcularCorte, evaluarConteo } from '@plataforma/calculos';

const n = (v) => (v === null || v === undefined ? null : Number(v));

// cuadra, sobra, falta o sin_conteo (cuando un administrador global cerró el turno sin contar)
function resultadoDe(f) {
  if (f.sin_conteo) return { resultado: 'sin_conteo', diferencia: null };
  return evaluarConteo({ esperado: Number(f.esperado), contado: Number(f.contado) });
}

export function corteLista(f) {
  const { resultado, diferencia } = resultadoDe(f);
  return {
    turnoId: f.turno_id,
    fechaOperativa: f.fecha_operativa,
    cerradoEn: f.cerrado_en,
    cierreTardio: f.cierre_tardio,
    zonaHoraria: f.zona,
    caja: f.caja,
    sucursal: f.sucursal,
    cajero: f.cajero,
    sinConteo: f.sin_conteo,
    resultado,
    diferencia,
    esperado: Number(f.esperado),
    contado: n(f.contado),
    entregado: n(f.entregado),
  };
}

export function corteDetalle(f, movimientos, ajustes, ventas) {
  const { resultado, diferencia } = resultadoDe(f);
  const calculo = calcularCorte({
    fondo: Number(f.fondo_inicial),
    cobrosEfectivo: Number(f.cobros_efectivo),
    cobrosTarjeta: Number(f.cobros_tarjeta),
    cobrosTransferencia: Number(f.cobros_transferencia),
    reembolsosEfectivo: Number(f.reembolsos_efectivo),
    reembolsosTarjeta: Number(f.reembolsos_tarjeta),
    reembolsosTransferencia: Number(f.reembolsos_transferencia),
    gastos: Number(f.gastos),
    retiros: Number(f.retiros),
  });
  return {
    turnoId: f.turno_id,
    caja: f.caja,
    sucursal: f.sucursal,
    cajero: f.cajero,
    cerro: f.cerro,
    zonaHoraria: f.zona,
    fechaOperativa: f.fecha_operativa,
    abiertoEn: f.abierto_en,
    cerradoEn: f.cerrado_en,
    cierreTardio: f.cierre_tardio,
    sinConteo: f.sin_conteo,
    ventas: ventas,
    // Las cifras se guardaron al cerrar: un cambio posterior no altera cortes viejos
    calculo: { ...calculo, esperado: Number(f.esperado) },
    resultado,
    diferencia,
    contado: n(f.contado),
    dejado: n(f.dejado),
    entregado: n(f.entregado),
    movimientos,
    ajustes: ajustes.map((a) => ({
      id: a.id,
      tipo: a.es_devolucion ? 'devolucion' : a.tipo,
      folio: a.folio,
      motivo: a.motivo,
      cancelado: Number(a.valor_cancelado),
      devuelto: Number(a.devuelto),
      retenido: Number(a.retenido),
      forma: a.forma ?? null,
      creadoEn: a.creado_en,
      hizo: a.hizo,
      autorizo: a.autorizo,
    })),
  };
}

// Turno todavía abierto: mismas cifras que un corte, calculadas al momento. Sin conteo ni diferencia.
export function corteEnCurso(t, calculo, movimientos, ajustes, ventas) {
  return {
    ...corteDetalle(
      {
        turno_id: t.id,
        sin_conteo: true,
        fondo_inicial: calculo.fondo,
        cobros_efectivo: calculo.cobrosEfectivo,
        cobros_tarjeta: calculo.cobrosTarjeta,
        cobros_transferencia: calculo.cobrosTransferencia,
        reembolsos_efectivo: calculo.reembolsosEfectivo,
        reembolsos_tarjeta: calculo.reembolsosTarjeta,
        reembolsos_transferencia: calculo.reembolsosTransferencia,
        gastos: calculo.gastos,
        retiros: calculo.retiros,
        esperado: calculo.esperado,
        contado: null,
        diferencia: null,
        dejado: null,
        entregado: null,
        fecha_operativa: t.fecha_operativa,
        abierto_en: t.abierto_en,
        cerrado_en: null,
        cierre_tardio: false,
        caja: t.caja_nombre,
        sucursal: t.sucursal_nombre,
        cajero: t.usuario_nombre,
        cerro: null,
        zona: t.zona,
      },
      movimientos,
      ajustes,
      ventas
    ),
    enCurso: true,
    sinConteo: false,
    resultado: null,
    consultadoEn: new Date().toISOString(),
  };
}