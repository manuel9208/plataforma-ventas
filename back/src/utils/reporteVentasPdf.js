import { aCentavos, aMonto, nombreUnidad } from '@plataforma/calculos';
import { COLOR, DocumentoPdf } from './pdfDocumento.js';
import { crearFormato, textoCelda } from './formatoReporte.js';

const FORMAS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
const PESOS = {
  sucursal: 1.3,
  folio: 1.1,
  fecha: 1.5,
  cliente: 2,
  telefono: 1.3,
  cajero: 1.4,
  tipo: 1.6,
  estado: 1.3,
  entrega: 1.2,
  articulos: 4,
  descuentoPromocion: 1.3,
  descuentoManual: 1.2,
  puntosUsados: 1.1,
  financiamiento: 1.2,
};
const COLORES_GRAFICA = [COLOR.primario, COLOR.acento, '#8b95ad', '#cbd2e1'];
const MAX_FILAS_CONSUMO = 40;

const derecha = { alinear: 'right' };
const sumar = (filas, id) => aMonto(filas.reduce((s, f) => s + Math.round(aCentavos(f[id] ?? 0)), 0));
const veces = (n) => `${n} ${n === 1 ? 'vez' : 'veces'}`;

function textoCambio(c, fmt) {
  if (c.tendencia === 'sinBase') return 'Entonces no hubo ventas';
  if (c.tendencia === 'igual') return 'Igual';
  const signo = c.tendencia === 'sube' ? '+' : '-';
  return `${signo}${Math.abs(c.porcentaje)}% (${signo}${fmt.dinero(Math.abs(c.diferencia))})`;
}

// d: lo que arma exportarVentas.service. Devuelve un Buffer con el PDF.
export async function construirPdf(d) {
  const fmt = crearFormato(d.moneda);
  const { cifras: c } = d.rep;
  const doc = new DocumentoPdf({
    tamano: d.columnas.length > 12 ? 'A3' : 'A4',
    titulo: `Reporte de ventas - ${d.empresa}`,
    autor: d.quien,
    pie: `${d.empresa} · Reporte de ventas · Generado el ${d.generado} por ${d.quien}`,
  });

  doc.encabezado({
    empresa: d.empresa,
    titulo: 'Reporte de ventas',
    derecha: d.periodoTexto,
    lineas: [`Sucursales: ${d.sucursales.join(', ')}`, d.filtrosTexto],
  });

  // ---------- Resumen ----------
  doc.tarjetas([
    { titulo: 'Vendido', valor: fmt.dinero(c.vendido), nota: `${c.notas} ${c.notas === 1 ? 'nota o venta' : 'notas y ventas'}${c.canceladas ? ` · ${c.canceladas} canceladas` : ''}` },
    { titulo: 'Abonado', valor: fmt.dinero(c.abonado), nota: 'Lo que han pagado esas notas' },
    { titulo: 'Pendiente', valor: fmt.dinero(c.pendiente), nota: 'Lo que esas notas todavía deben', color: c.pendiente > 0 ? COLOR.ambar : undefined },
    { titulo: 'Dinero que entró', valor: fmt.dinero(c.entro.total), nota: 'Cobrado en el periodo, menos devoluciones', destacada: true },
  ]);
  if (c.porCobrarAnteriores.monto > 0) {
    doc.parrafo(`Además, hay ${fmt.dinero(c.porCobrarAnteriores.monto)} por cobrar de ${c.porCobrarAnteriores.notas} notas de días anteriores.`, { color: COLOR.ambar });
  }

  const grupo = (t) => ({ celdas: [t, ''], negrita: true, fondo: COLOR.crema });
  const filasResumen = [
    grupo('Cómo pagaron (dinero que entró)'),
    ...['efectivo', 'tarjeta', 'transferencia'].map((f) => [FORMAS[f], fmt.dinero(c.entro[f])]),
    ...(d.esLimpieza
      ? [grupo('Qué se vendió'), ['Notas de servicio', fmt.dinero(c.vendidoNotas)], ['Ventas de mostrador', fmt.dinero(c.vendidoVentas)]]
      : []),
    grupo('Descuentos y cargos (incluidos en lo vendido)'),
    ['Por promociones', fmt.dinero(c.descuentoPromocion)],
    ['Descuentos manuales', fmt.dinero(c.descuentoManual)],
    ['Puntos usados', fmt.dinero(c.puntosUsados)],
    ...(d.esLimpieza ? [['Financiamiento cobrado', fmt.dinero(c.financiamiento)]] : []),
    ...(c.iva > 0 ? [['IVA', fmt.dinero(c.iva)]] : []),
  ];
  doc.seccion('Resumen');
  doc.tabla({ columnas: [{ etiqueta: 'Concepto', peso: 3 }, { etiqueta: 'Importe', peso: 1.4, ...derecha }], filas: filasResumen, ancho: doc.ancho * 0.5, fuente: 9 });

  if (d.rep.porSucursal.length > 1) {
    doc.seccion('Por sucursal');
    doc.tabla({
      columnas: [
        { etiqueta: 'Sucursal', peso: 2 },
        { etiqueta: 'Notas', peso: 0.8, ...derecha },
        { etiqueta: 'Vendido', peso: 1.3, ...derecha },
        { etiqueta: 'Abonado', peso: 1.3, ...derecha },
        { etiqueta: 'Pendiente', peso: 1.3, ...derecha },
        { etiqueta: 'Dinero que entró', peso: 1.5, ...derecha },
      ],
      filas: d.rep.porSucursal.map((s) => [s.sucursal, String(s.notas), fmt.dinero(s.vendido), fmt.dinero(s.abonado), fmt.dinero(s.pendiente), fmt.dinero(s.entro.total)]),
      fuente: 9,
    });
  }

  // ---------- Notas y ventas ----------
  doc.seccion('Notas y ventas', `${d.rep.total} ${d.rep.total === 1 ? 'registro' : 'registros'}${d.truncado ? ` · se muestran las primeras ${d.rep.datos.length}` : ''}`);
  if (d.truncado) doc.parrafo('Hay más registros que los que caben en este reporte. Acota el periodo o los filtros para verlos todos.', { color: COLOR.ambar, tam: 8.5 });

  const columnasTabla = d.columnas.map((col) => ({
    etiqueta: col.etiqueta,
    peso: col.tipo === 'dinero' ? 1.1 : (PESOS[col.id] ?? 1),
    alinear: col.tipo === 'dinero' ? 'right' : 'left',
    envolver: col.id === 'articulos' ? 3 : undefined,
  }));
  const idPrimeraSinSuma = d.columnas.findIndex((col) => !col.suma);
  const filaTotal = d.rep.datos.length
    ? d.columnas.map((col, i) => (col.suma ? fmt.dinero(sumar(d.rep.datos, col.id)) : i === idPrimeraSinSuma ? (d.truncado ? 'Total de lo mostrado' : 'Total') : ''))
    : null;
  doc.tabla({
    columnas: columnasTabla,
    filas: d.rep.datos.map((f) => ({ celdas: d.columnas.map((col) => textoCelda(col, f, fmt)), suave: f.estado === 'cancelada' })),
    fuente: d.columnas.length > 9 && d.columnas.length <= 12 ? 7 : 8,
    filaTotal,
    vacio: 'No hay notas ni ventas con esos filtros.',
  });

  // ---------- Consumo ----------
  const { con } = d;
  doc.nuevaPagina();
  doc.seccion('Lo que se consumió', 'Lo vendido en el periodo, sin lo cancelado ni lo devuelto.');
  if (d.esLimpieza && d.giro !== 'productos') {
    doc.subtitulo(`Servicios: ${con.servicios.veces} ${con.servicios.veces === 1 ? 'servicio hecho' : 'servicios hechos'} · ${fmt.dinero(con.servicios.dinero)}`);
    const filas = con.servicios.items.slice(0, MAX_FILAS_CONSUMO).flatMap((s) => [
      { celdas: [s.nombre, veces(s.cantidad), fmt.dinero(s.dinero), String(s.notas), `${s.porcentaje}%`], negrita: true },
      ...(s.porTipo.length > 1 || s.porTipo[0]?.tipo
        ? s.porTipo.map((t) => ({ celdas: [`      ${t.tipo ?? 'Sin tipo'}`, veces(t.cantidad), fmt.dinero(t.dinero), '', ''], suave: true }))
        : []),
    ]);
    doc.tabla({
      columnas: [
        { etiqueta: 'Servicio', peso: 3 },
        { etiqueta: 'Veces', peso: 1, ...derecha },
        { etiqueta: 'Dinero', peso: 1.2, ...derecha },
        { etiqueta: 'En notas', peso: 0.8, ...derecha },
        { etiqueta: '% del dinero', peso: 1, ...derecha },
      ],
      filas,
      vacio: 'No se hizo ningún servicio en este periodo.',
    });
  }
  if (d.giro !== 'servicios') {
    doc.subtitulo(`Productos: ${fmt.dinero(con.productos.dinero)} en total`);
    doc.tabla({
      columnas: [
        { etiqueta: 'Producto', peso: 3 },
        { etiqueta: 'Cantidad', peso: 1.2, ...derecha },
        { etiqueta: 'Dinero', peso: 1.2, ...derecha },
        { etiqueta: 'En ventas', peso: 0.8, ...derecha },
        { etiqueta: '% del dinero', peso: 1, ...derecha },
      ],
      filas: con.productos.items
        .slice(0, MAX_FILAS_CONSUMO)
        .map((p) => [p.nombre, `${Number(p.cantidad.toFixed(3))} ${nombreUnidad(p.unidad ?? 'pieza').toLowerCase()}`, fmt.dinero(p.dinero), String(p.notas), `${p.porcentaje}%`]),
      vacio: 'No se vendió ningún producto en este periodo.',
    });
  }
  if (d.esLimpieza && con.extras.items.length) {
    doc.subtitulo(`Extras de los servicios: ${fmt.dinero(con.extras.dinero)} en total`);
    doc.tabla({
      columnas: [
        { etiqueta: 'Extra', peso: 3 },
        { etiqueta: 'Veces', peso: 1, ...derecha },
        { etiqueta: 'Dinero', peso: 1.2, ...derecha },
        { etiqueta: 'En notas', peso: 0.8, ...derecha },
        { etiqueta: '% del dinero', peso: 1, ...derecha },
      ],
      filas: con.extras.items.slice(0, MAX_FILAS_CONSUMO).map((x) => [x.nombre, veces(x.cantidad), fmt.dinero(x.dinero), String(x.notas), `${x.porcentaje}%`]),
    });
  }
  const lista = (b) => `${b.filas.map((x) => x.nombre).join(', ')}${b.total > b.filas.length ? ` ... y ${b.total - b.filas.length} más` : ''}`;
  doc.subtitulo('Lo que no se vendió');
  if (d.giro !== 'servicios') doc.parrafo(con.sinVentas.productos.total ? `Productos sin ventas (${con.sinVentas.productos.total}): ${lista(con.sinVentas.productos)}` : 'Todos los productos se vendieron.', { tam: 8.5 });
  if (d.esLimpieza && d.giro !== 'productos') doc.parrafo(con.sinVentas.servicios.total ? `Servicios sin ventas (${con.sinVentas.servicios.total}): ${lista(con.sinVentas.servicios)}` : 'Todos los servicios se vendieron.', { tam: 8.5 });

  // ---------- Estadísticas ----------
  const { est } = d;
  doc.nuevaPagina();
  doc.seccion('Estadísticas', est.recortado ? 'Las comparaciones usan solo los mismos días que lleva este periodo.' : 'Cómo va este periodo frente a otros.');
  doc.tabla({
    columnas: [
      { etiqueta: 'Periodo', peso: 2.5 },
      { etiqueta: 'Fechas', peso: 2.5 },
      { etiqueta: 'Vendido', peso: 1.3, ...derecha },
      { etiqueta: 'Notas', peso: 0.7, ...derecha },
      { etiqueta: 'Cambio', peso: 2, ...derecha },
    ],
    filas: [
      { celdas: ['Este periodo', `${fmt.fechaDia(d.desde)} al ${fmt.fechaDia(d.hasta)}`, fmt.dinero(est.actual.vendido), String(est.actual.notas), ''], negrita: true },
      ...est.comparativa.map((x) => [x.etiqueta, `${fmt.fechaDia(x.desde)} al ${fmt.fechaDia(x.hasta)}`, fmt.dinero(x.vendido), String(x.notas), textoCambio(x, fmt)]),
    ],
    fuente: 9,
  });

  if (est.meta.sinBase) {
    doc.parrafo(`Meta de venta: todavía no hay meta, porque en "${est.meta.contra.toLowerCase()}" no se vendió nada.`, { color: COLOR.suave });
  } else {
    doc.tarjetas([
      { titulo: 'Meta de venta', valor: fmt.dinero(est.meta.meta), nota: `${est.meta.contra}${est.meta.porcentaje !== null ? ` + ${est.meta.porcentaje}%` : ''}` },
      { titulo: 'Llevas', valor: fmt.dinero(est.meta.vendido), nota: est.meta.cumplida ? 'Meta cumplida' : `Faltan ${fmt.dinero(est.meta.falta)}` },
      { titulo: 'Avance', valor: `${est.meta.avance ?? 0}%`, nota: 'De la meta', color: est.meta.cumplida ? COLOR.verde : undefined },
    ]);
  }

  doc.subtitulo('Ventas por hora');
  doc.parrafo(est.horas.horarioConfigurado ? 'Según el horario de la sucursal. Las horas con fondo amarillo están abiertas y no tuvieron ventas.' : 'Se usó el horario de 9:00 a 21:00 porque aún no hay horario configurado. Las horas con fondo amarillo no tuvieron ventas.', { color: COLOR.suave, tam: 8 });
  doc.graficaHoras({ filas: est.horas.filas, series: est.horas.series, colores: COLORES_GRAFICA, textoHora: (h) => `${h}:00` });
  if (est.horas.pico !== null) doc.parrafo(`Hora con más ventas: ${est.horas.pico}:00`, { tam: 8.5 });

  // ---------- Análisis ----------
  const { ana } = d;
  doc.nuevaPagina();
  doc.seccion('Para decidir mejor');
  doc.tarjetas([
    { titulo: 'Notas y ventas', valor: String(ana.resumen.vigentes), nota: 'Las que siguen vigentes' },
    { titulo: 'Ticket promedio', valor: fmt.dinero(ana.resumen.ticketPromedio), nota: 'Lo que deja cada nota o venta' },
    { titulo: 'Canceladas', valor: String(ana.resumen.canceladas), nota: ana.resumen.notas ? `De ${ana.resumen.notas} levantadas` : 'Ninguna en el periodo', color: ana.resumen.canceladas > 0 ? COLOR.rojo : undefined },
    ...(d.esLimpieza ? [{ titulo: 'Por cobrar hoy', valor: fmt.dinero(ana.cobranza.monto), nota: 'Deuda de hoy, sin importar el periodo', color: ana.cobranza.monto > 0 ? COLOR.ambar : undefined }] : []),
  ]);

  doc.subtitulo('Por empleado (quien levantó la nota)');
  doc.tabla({
    columnas: [
      { etiqueta: 'Empleado', peso: 2.5 },
      { etiqueta: 'Notas', peso: 0.8, ...derecha },
      { etiqueta: 'Vendido', peso: 1.3, ...derecha },
      { etiqueta: 'Ticket promedio', peso: 1.3, ...derecha },
      { etiqueta: '% del total', peso: 1, ...derecha },
    ],
    filas: ana.empleados.map((e) => [e.nombre, String(e.notas), fmt.dinero(e.vendido), fmt.dinero(e.ticketPromedio), `${e.porcentaje}%`]),
    vacio: 'Nadie vendió en este periodo.',
  });

  doc.subtitulo('Por día de la semana');
  doc.tabla({
    columnas: [
      { etiqueta: 'Día', peso: 2 },
      { etiqueta: 'Días contados', peso: 1, ...derecha },
      { etiqueta: 'Notas', peso: 0.8, ...derecha },
      { etiqueta: 'Vendido', peso: 1.3, ...derecha },
      { etiqueta: 'Promedio por día', peso: 1.4, ...derecha },
    ],
    filas: ana.diasSemana.dias.map((x) => ({
      celdas: [`${x.nombre}${x.dia === ana.diasSemana.mejor ? ' (mejor día)' : ''}`, String(x.veces), String(x.notas), fmt.dinero(x.vendido), x.veces ? fmt.dinero(x.promedio) : '-'],
      negrita: x.dia === ana.diasSemana.mejor,
    })),
  });

  doc.subtitulo('Clientes');
  doc.tabla({
    columnas: [{ etiqueta: 'Grupo', peso: 3 }, { etiqueta: 'Cantidad', peso: 1, ...derecha }, { etiqueta: 'Vendido', peso: 1.3, ...derecha }],
    filas: [
      ['Clientes nuevos (se registraron en el periodo)', String(ana.clientes.nuevos.clientes), fmt.dinero(ana.clientes.nuevos.vendido)],
      ['Clientes que regresan', String(ana.clientes.recurrentes.clientes), fmt.dinero(ana.clientes.recurrentes.vendido)],
      ['Ventas sin cliente registrado', String(ana.clientes.sinCliente.ventas), fmt.dinero(ana.clientes.sinCliente.vendido)],
    ],
    ancho: doc.ancho * 0.7,
  });

  doc.subtitulo('Cancelaciones y devoluciones');
  doc.tabla({
    columnas: [
      { etiqueta: 'Concepto', peso: 2.5 },
      { etiqueta: 'Operaciones', peso: 1, ...derecha },
      { etiqueta: 'Cancelado', peso: 1.2, ...derecha },
      { etiqueta: 'Retenido', peso: 1.2, ...derecha },
      { etiqueta: 'Devuelto', peso: 1.2, ...derecha },
    ],
    filas: ana.cancelaciones.categorias
      .filter((x) => d.esLimpieza || x.id === 'devolucion')
      .map((x) => [x.etiqueta, String(x.operaciones), fmt.dinero(x.cancelado), fmt.dinero(x.retenido), fmt.dinero(x.devuelto)]),
    filaTotal: ['Dinero devuelto', '', '', '', fmt.dinero(ana.cancelaciones.devuelto)],
  });
  if (ana.cancelaciones.motivos.length) {
    doc.parrafo(`Motivos que más se repiten: ${ana.cancelaciones.motivos.map((m) => `${m.motivo} (${m.veces})`).join(' · ')}`, { tam: 8.5 });
  }

  if (d.esLimpieza) {
    doc.subtitulo(`Cobranza: lo que se debe hoy · ${fmt.dinero(ana.cobranza.monto)} en ${ana.cobranza.notas} notas`);
    doc.tabla({
      columnas: [{ etiqueta: 'Antigüedad', peso: 2 }, { etiqueta: 'Notas', peso: 1, ...derecha }, { etiqueta: 'Monto', peso: 1.3, ...derecha }],
      filas: ana.cobranza.rangos.map((r) => [r.etiqueta, String(r.notas), fmt.dinero(r.monto)]),
      ancho: doc.ancho * 0.5,
    });
    if (ana.cobranza.masAtrasadas.length) {
      doc.parrafo('Las notas más atrasadas:', { negrita: true, tam: 8.5 });
      doc.tabla({
        columnas: [
          { etiqueta: 'Folio', peso: 1.2 },
          { etiqueta: 'Cliente', peso: 2.5 },
          { etiqueta: 'Teléfono', peso: 1.5 },
          { etiqueta: 'Sucursal', peso: 1.5 },
          { etiqueta: 'Saldo', peso: 1.2, ...derecha },
          { etiqueta: 'Antigüedad', peso: 1.2, ...derecha },
        ],
        filas: ana.cobranza.masAtrasadas.map((n) => [n.folio, n.cliente ?? 'Sin cliente', n.telefono ? fmt.telefono(n.telefono) : '-', n.sucursal, fmt.dinero(n.saldo), n.dias === 0 ? 'de hoy' : `${n.dias} días`]),
      });
    }
  }

  doc.subtitulo('Descuentos dados');
  doc.tabla({
    columnas: [{ etiqueta: 'Descuento', peso: 3 }, { etiqueta: 'Artículos', peso: 1, ...derecha }, { etiqueta: 'Importe', peso: 1.3, ...derecha }],
    filas: [
      { celdas: [`Por promociones · ${fmt.dinero(ana.descuentos.totalPromociones)}`, '', ''], negrita: true, fondo: COLOR.crema },
      ...ana.descuentos.promociones.map((x) => [x.nombre, String(x.veces), fmt.dinero(x.descuento)]),
      { celdas: [`Descuentos manuales (quién autorizó) · ${fmt.dinero(ana.descuentos.totalManuales)}`, '', ''], negrita: true, fondo: COLOR.crema },
      ...ana.descuentos.manuales.map((x) => [x.nombre, String(x.veces), fmt.dinero(x.descuento)]),
    ],
    vacio: 'No se dieron descuentos en este periodo.',
    ancho: doc.ancho * 0.7,
  });

  return doc.terminar();
}