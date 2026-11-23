import { aCentavos, aMonto, agruparCobranza, armarDiasSemana, ticketPromedio } from '@plataforma/calculos';

const n = (v) => Number(v ?? 0);
const c = (v) => Math.round(aCentavos(n(v)));
const sumaC = (lista, clave) => lista.reduce((s, x) => s + c(x[clave]), 0);
const porcentaje = (parteC, totalC) => (totalC > 0 ? Math.round((parteC * 1000) / totalC) / 10 : 0);

const ETIQUETA_AJUSTE = {
  cancelacion: 'Notas canceladas',
  devolucion: 'Devoluciones de mostrador',
  reembolso: 'Reembolsos',
};
const categoriaDe = (f) => (f.tipo === 'reembolso' ? 'reembolso' : f.tiene_servicios ? 'cancelacion' : 'devolucion');

function bloqueAjustes(filas, motivos) {
  const acum = Object.fromEntries(Object.keys(ETIQUETA_AJUSTE).map((k) => [k, { operaciones: 0, canceladoC: 0, devueltoC: 0, retenidoC: 0 }]));
  for (const f of filas) {
    const a = acum[categoriaDe(f)];
    a.operaciones += n(f.operaciones);
    a.canceladoC += c(f.cancelado);
    a.devueltoC += c(f.devuelto);
    a.retenidoC += c(f.retenido);
  }
  const lista = Object.entries(acum).map(([id, a]) => ({
    id,
    etiqueta: ETIQUETA_AJUSTE[id],
    operaciones: a.operaciones,
    cancelado: aMonto(a.canceladoC),
    devuelto: aMonto(a.devueltoC),
    retenido: aMonto(a.retenidoC),
  }));
  return {
    categorias: lista,
    operaciones: lista.reduce((s, x) => s + x.operaciones, 0),
    devuelto: aMonto(Object.values(acum).reduce((s, a) => s + a.devueltoC, 0)),
    motivos: motivos.map((m) => ({ motivo: m.motivo, veces: n(m.veces), devuelto: n(m.devuelto) })),
  };
}

function bloqueDescuentos(filas) {
  const promos = filas.filter((f) => f.origen === 'promocion');
  const manuales = filas.filter((f) => f.origen === 'manual');
  const forma = (f, nombre) => ({ nombre, veces: n(f.lineas), descuento: n(f.descuento) });
  return {
    promociones: promos.map((f) => forma(f, f.nombre ?? 'Promoción')),
    manuales: manuales.map((f) => forma(f, f.autorizo_nombre ?? 'Sin dato')),
    totalPromociones: aMonto(sumaC(promos, 'descuento')),
    totalManuales: aMonto(sumaC(manuales, 'descuento')),
  };
}

export function respuestaAnalisis({ grupos, empleados, dias, clientes, ajustes, motivos, cobranza, descuentos, periodo, hastaContado }) {
  const notas = grupos.reduce((s, g) => s + n(g.notas), 0);
  const canceladas = grupos.reduce((s, g) => s + n(g.canceladas), 0);
  const vigentes = notas - canceladas;
  const vendido = aMonto(sumaC(grupos, 'vendido'));
  const vendidoC = c(vendido);

  const cl = clientes ?? {};
  const cobranzaTotalC = sumaC(cobranza.porEdad, 'monto');

  return {
    periodo,
    resumen: { notas, canceladas, vigentes, vendido, ticketPromedio: ticketPromedio(vendido, vigentes) },
    empleados: empleados.map((f) => {
      const vigentesE = n(f.notas) - n(f.canceladas);
      return {
        id: n(f.id),
        nombre: f.nombre,
        notas: n(f.notas),
        canceladas: n(f.canceladas),
        vendido: n(f.vendido),
        pendiente: n(f.pendiente),
        ticketPromedio: ticketPromedio(f.vendido, vigentesE),
        porcentaje: porcentaje(c(f.vendido), vendidoC),
      };
    }),
    diasSemana: armarDiasSemana(dias, periodo.desde, hastaContado),
    clientes: {
      nuevos: { clientes: n(cl.nuevos), vendido: n(cl.vendido_nuevos) },
      recurrentes: { clientes: n(cl.recurrentes), vendido: n(cl.vendido_recurrentes) },
      sinCliente: { ventas: n(cl.sin_cliente), vendido: n(cl.vendido_sin_cliente) },
    },
    cancelaciones: bloqueAjustes(ajustes, motivos),
    cobranza: {
      notas: cobranza.porEdad.reduce((s, f) => s + n(f.notas), 0),
      monto: aMonto(cobranzaTotalC),
      rangos: agruparCobranza(cobranza.porEdad),
      masAtrasadas: cobranza.masAtrasadas.map((f) => ({
        id: f.id,
        folio: f.folio,
        sucursal: f.sucursal,
        cliente: f.cliente ?? null,
        telefono: f.telefono ?? null,
        saldo: n(f.saldo),
        dias: n(f.dias),
      })),
    },
    descuentos: bloqueDescuentos(descuentos),
  };
}