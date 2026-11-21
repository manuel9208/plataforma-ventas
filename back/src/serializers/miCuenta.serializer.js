import { estadoDeNota, estadoPerfil, resumenNota } from '@plataforma/calculos';

const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));
const n = (v) => Number(v ?? 0);

export const datosCliente = (f) => ({
  nombre: f.nombre,
  telefono: f.telefono,
  correo: f.correo,
  cumpleanos: f.cumple_mes && f.cumple_dia ? { mes: f.cumple_mes, dia: f.cumple_dia } : null,
  perfil: estadoPerfil({ correo: f.correo, cumpleMes: f.cumple_mes, cumpleDia: f.cumple_dia, tienePin: f.tiene_pin }),
  avisoPendiente: !f.aviso_privacidad_en,
});

// El saldo sale de la MISMA fórmula de siempre (shared/calculos/saldo.js)
export function pedido(f, servicios) {
  const r = resumenNota({
    total: n(f.total),
    cancelado: n(f.cancelado),
    ajustado: n(f.ajustado),
    retenido: n(f.retenido),
    reembolsado: n(f.reembolsado),
    cobrado: n(f.pagado),
  });
  return {
    folio: f.folio,
    sucursal: f.sucursal,
    creadaEn: f.creado_en,
    zonaHoraria: f.zona,
    // recibida | en_proceso | lista | entregada | cancelada
    estado: estadoDeNota(servicios.map((s) => s.estado_trabajo)),
    total: r.total,
    pagado: r.pagado,
    saldo: r.saldo,
    servicios: servicios.map((s) => ({
      nombre: s.nombre,
      // recibido | en_proceso | listo | entregado | cancelado (la pantalla muestra los dos primeros como "En espera")
      estado: s.estado_trabajo,
      fechaPrometida: s.fecha_prometida,
      listoEn: s.listo_en,
      articulo: sinVacios({ marca: s.marca, talla: s.talla, color: s.color, modelo: s.modelo, textura: s.textura }),
    })),
  };
}

export const compra = (f) => ({
  folio: f.folio,
  sucursal: f.sucursal,
  creadaEn: f.creado_en,
  zonaHoraria: f.zona,
  tipo: f.tiene_servicios ? 'nota' : 'venta',
  // Lo que vale ahora (descontando lo cancelado o devuelto)
  total: resumenNota({ total: n(f.total), cancelado: n(f.cancelado), ajustado: n(f.ajustado), retenido: n(f.retenido) }).total,
});