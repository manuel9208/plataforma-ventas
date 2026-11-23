import ExcelJS from 'exceljs';
import { aCentavos, aMonto, nombreUnidad } from '@plataforma/calculos';
import { crearFormato, formatoExcelMoneda, textoCelda } from './formatoReporte.js';

const AZUL = 'FF1D2B4F';
const CREMA = 'FFF3EFE6';
const GRIS = 'FF6B7280';
const FORMAS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
const ANCHOS = { sucursal: 20, folio: 14, fecha: 18, cliente: 28, telefono: 16, cajero: 20, tipo: 20, estado: 18, entrega: 16, articulos: 60 };

function estilar(fila, { negrita = false, tam, color, relleno } = {}) {
  fila.eachCell((celda) => {
    celda.font = { bold: negrita, ...(tam ? { size: tam } : {}), ...(color ? { color: { argb: color } } : {}) };
    if (relleno) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
  });
}

// Una tabla con título al final de la hoja. columnas: [{ etiqueta, fmt }] · filas: [valores] o [{ valores, negrita }]
function tabla(ws, { titulo, nota, columnas, filas }) {
  if (ws.rowCount > 0) ws.addRow([]);
  if (titulo) estilar(ws.addRow([titulo]), { negrita: true, tam: 12, color: AZUL });
  if (nota) estilar(ws.addRow([nota]), { color: GRIS });
  estilar(ws.addRow(columnas.map((c) => c.etiqueta)), { negrita: true, color: 'FFFFFFFF', relleno: AZUL });
  if (!filas.length) {
    ws.addRow(['Sin datos en este periodo.']);
    return;
  }
  for (const f of filas) {
    const fila = ws.addRow(Array.isArray(f) ? f : f.valores);
    columnas.forEach((c, i) => {
      if (c.fmt) fila.getCell(i + 1).numFmt = c.fmt;
    });
    if (!Array.isArray(f) && f.negrita) estilar(fila, { negrita: true });
  }
}

const sumar = (filas, id) => aMonto(filas.reduce((s, f) => s + Math.round(aCentavos(f[id] ?? 0)), 0));
const anchosDe = (ws, lista) => lista.forEach((w, i) => (ws.getColumn(i + 1).width = w));

export async function construirExcel(d) {
  const fmt = crearFormato(d.moneda);
  const DINERO = formatoExcelMoneda(d.moneda);
  const PCT = '0.0"%"';
  const ENTERO = '#,##0';
  const { cifras: c } = d.rep;
  const { est, con, ana } = d;

  const wb = new ExcelJS.Workbook();
  wb.creator = d.quien;
  wb.created = new Date();
  wb.title = `Reporte de ventas - ${d.empresa}`;

  // ---------- Resumen ----------
  const res = wb.addWorksheet('Resumen');
  estilar(res.addRow([d.empresa]), { negrita: true, tam: 16, color: AZUL });
  estilar(res.addRow(['Reporte de ventas']), { negrita: true, tam: 12 });
  res.addRow([d.periodoTexto]);
  res.addRow([`Sucursales: ${d.sucursales.join(', ')}`]);
  res.addRow([d.filtrosTexto]);
  estilar(res.addRow([`Generado el ${d.generado} por ${d.quien}`]), { color: GRIS });

  tabla(res, {
    titulo: 'Cifras',
    columnas: [{ etiqueta: 'Concepto' }, { etiqueta: 'Importe', fmt: DINERO }, { etiqueta: 'Detalle' }],
    filas: [
      ['Vendido', c.vendido, `${c.notas} notas y ventas · ${c.canceladas} canceladas`],
      ['Abonado', c.abonado, 'Lo que han pagado esas notas'],
      ['Pendiente', c.pendiente, 'Lo que esas notas todavía deben'],
      { valores: ['Dinero que entró', c.entro.total, 'Cobrado en el periodo, menos devoluciones'], negrita: true },
      ['Por cobrar de días anteriores', c.porCobrarAnteriores.monto, `${c.porCobrarAnteriores.notas} notas`],
    ],
  });
  tabla(res, {
    titulo: 'Cómo pagaron (dinero que entró)',
    columnas: [{ etiqueta: 'Forma' }, { etiqueta: 'Importe', fmt: DINERO }],
    filas: ['efectivo', 'tarjeta', 'transferencia'].map((f) => [FORMAS[f], c.entro[f]]),
  });
  tabla(res, {
    titulo: 'Qué se vendió y descuentos',
    columnas: [{ etiqueta: 'Concepto' }, { etiqueta: 'Importe', fmt: DINERO }],
    filas: [
      ...(d.esLimpieza ? [['Notas de servicio', c.vendidoNotas], ['Ventas de mostrador', c.vendidoVentas]] : []),
      ['Descuentos por promociones', c.descuentoPromocion],
      ['Descuentos manuales', c.descuentoManual],
      ['Puntos usados', c.puntosUsados],
      ...(d.esLimpieza ? [['Financiamiento cobrado', c.financiamiento]] : []),
      ['IVA', c.iva],
    ],
  });
  tabla(res, {
    titulo: 'Por sucursal',
    columnas: [
      { etiqueta: 'Sucursal' },
      { etiqueta: 'Notas', fmt: ENTERO },
      { etiqueta: 'Vendido', fmt: DINERO },
      { etiqueta: 'Abonado', fmt: DINERO },
      { etiqueta: 'Pendiente', fmt: DINERO },
      { etiqueta: 'Dinero que entró', fmt: DINERO },
    ],
    filas: d.rep.porSucursal.map((s) => [s.sucursal, s.notas, s.vendido, s.abonado, s.pendiente, s.entro.total]),
  });
  tabla(res, {
    titulo: 'Comparativa',
    nota: est.recortado ? 'Las comparaciones usan solo los mismos días que lleva este periodo.' : undefined,
    columnas: [{ etiqueta: 'Periodo' }, { etiqueta: 'Desde' }, { etiqueta: 'Hasta' }, { etiqueta: 'Vendido', fmt: DINERO }, { etiqueta: 'Notas', fmt: ENTERO }, { etiqueta: 'Cambio %', fmt: PCT }, { etiqueta: 'Diferencia', fmt: DINERO }],
    filas: [
      { valores: ['Este periodo', fmt.fechaDia(d.desde), fmt.fechaDia(d.hasta), est.actual.vendido, est.actual.notas, null, null], negrita: true },
      ...est.comparativa.map((x) => [x.etiqueta, fmt.fechaDia(x.desde), fmt.fechaDia(x.hasta), x.vendido, x.notas, x.porcentaje, x.diferencia]),
    ],
  });
  tabla(res, {
    titulo: 'Meta de venta',
    columnas: [{ etiqueta: 'Concepto' }, { etiqueta: 'Valor' }],
    filas: est.meta.sinBase
      ? [['Meta', `Todavía no hay meta: en "${est.meta.contra}" no se vendió nada.`]]
      : [
          ['Se compara contra', est.meta.contra],
          ['Meta', fmt.dinero(est.meta.meta)],
          ['Llevas', fmt.dinero(est.meta.vendido)],
          ['Avance', `${est.meta.avance ?? 0}%`],
          ['Faltan', est.meta.cumplida ? 'Meta cumplida' : fmt.dinero(est.meta.falta)],
        ],
  });
  anchosDe(res, [38, 22, 24, 20, 20, 16, 16]);

  // ---------- Notas ----------
  const ws = wb.addWorksheet('Notas', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = d.columnas.map((col) => ({ header: col.etiqueta, key: col.id, width: col.tipo === 'dinero' ? 16 : (ANCHOS[col.id] ?? 18) }));
  estilar(ws.getRow(1), { negrita: true, color: 'FFFFFFFF', relleno: AZUL });
  d.columnas.forEach((col, i) => {
    if (col.id === 'articulos') ws.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' };
  });
  for (const f of d.rep.datos) {
    const fila = ws.addRow(d.columnas.map((col) => (col.tipo === 'dinero' ? (f[col.id] ?? null) : textoCelda(col, f, fmt))));
    d.columnas.forEach((col, i) => {
      if (col.tipo === 'dinero') fila.getCell(i + 1).numFmt = DINERO;
    });
  }
  const n = d.rep.datos.length;
  if (n) {
    const sinSuma = d.columnas.findIndex((col) => !col.suma);
    const totales = ws.addRow(
      d.columnas.map((col, i) => {
        if (col.suma) return { formula: `SUM(${ws.getColumn(i + 1).letter}2:${ws.getColumn(i + 1).letter}${n + 1})`, result: sumar(d.rep.datos, col.id) };
        return i === sinSuma ? (d.truncado ? 'Total de lo mostrado' : 'Total') : '';
      })
    );
    d.columnas.forEach((col, i) => {
      if (col.suma) totales.getCell(i + 1).numFmt = DINERO;
    });
    estilar(totales, { negrita: true, relleno: CREMA });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: d.columnas.length } };
  }
  if (d.truncado) {
    ws.addRow([]);
    ws.addRow([`Hay ${d.rep.total} registros; aquí van los primeros ${n}. Acota el periodo o los filtros para verlos todos.`]);
  }

  // ---------- Consumo ----------
  const hc = wb.addWorksheet('Consumo');
  if (d.esLimpieza && d.giro !== 'productos') {
    tabla(hc, {
      titulo: 'Servicios',
      nota: `${con.servicios.veces} servicios hechos · lo vendido sin cancelaciones ni devoluciones`,
      columnas: [{ etiqueta: 'Servicio' }, { etiqueta: 'Tipo de artículo' }, { etiqueta: 'Veces', fmt: ENTERO }, { etiqueta: 'Dinero', fmt: DINERO }, { etiqueta: 'En notas', fmt: ENTERO }, { etiqueta: '% del dinero', fmt: PCT }],
      filas: con.servicios.items.flatMap((s) => [
        { valores: [s.nombre, 'Todos los tipos', s.cantidad, s.dinero, s.notas, s.porcentaje], negrita: true },
        ...(s.porTipo.length > 1 || s.porTipo[0]?.tipo ? s.porTipo.map((t) => ['', t.tipo ?? 'Sin tipo', t.cantidad, t.dinero, null, null]) : []),
      ]),
    });
  }
  if (d.giro !== 'servicios') {
    tabla(hc, {
      titulo: 'Productos',
      columnas: [{ etiqueta: 'Producto' }, { etiqueta: 'Unidad' }, { etiqueta: 'Cantidad', fmt: '#,##0.###' }, { etiqueta: 'Dinero', fmt: DINERO }, { etiqueta: 'En ventas', fmt: ENTERO }, { etiqueta: '% del dinero', fmt: PCT }],
      filas: con.productos.items.map((p) => [p.nombre, nombreUnidad(p.unidad ?? 'pieza').toLowerCase(), p.cantidad, p.dinero, p.notas, p.porcentaje]),
    });
  }
  if (d.esLimpieza && con.extras.items.length) {
    tabla(hc, {
      titulo: 'Extras de los servicios',
      columnas: [{ etiqueta: 'Extra' }, { etiqueta: '' }, { etiqueta: 'Veces', fmt: ENTERO }, { etiqueta: 'Dinero', fmt: DINERO }, { etiqueta: 'En notas', fmt: ENTERO }, { etiqueta: '% del dinero', fmt: PCT }],
      filas: con.extras.items.map((x) => [x.nombre, '', x.cantidad, x.dinero, x.notas, x.porcentaje]),
    });
  }
  if (d.giro !== 'servicios') {
    tabla(hc, {
      titulo: `Productos sin ventas (${con.sinVentas.productos.total})`,
      columnas: [{ etiqueta: 'Producto' }, { etiqueta: 'SKU' }, { etiqueta: 'Departamento' }],
      filas: con.sinVentas.productos.filas.map((x) => [x.nombre, x.sku ?? '', x.departamento]),
    });
  }
  if (d.esLimpieza && d.giro !== 'productos') {
    tabla(hc, {
      titulo: `Servicios sin ventas (${con.sinVentas.servicios.total})`,
      columnas: [{ etiqueta: 'Servicio' }, { etiqueta: 'SKU' }, { etiqueta: 'Departamento' }],
      filas: con.sinVentas.servicios.filas.map((x) => [x.nombre, x.sku ?? '', x.departamento]),
    });
  }
  anchosDe(hc, [40, 22, 14, 16, 14, 14]);

  // ---------- Análisis ----------
  const an = wb.addWorksheet('Análisis');
  tabla(an, {
    titulo: 'Resumen',
    columnas: [{ etiqueta: 'Concepto' }, { etiqueta: 'Valor' }],
    filas: [
      ['Notas y ventas vigentes', ana.resumen.vigentes],
      ['Canceladas', ana.resumen.canceladas],
      ['Ticket promedio', fmt.dinero(ana.resumen.ticketPromedio)],
      ...(d.esLimpieza ? [['Por cobrar hoy', fmt.dinero(ana.cobranza.monto)]] : []),
    ],
  });
  tabla(an, {
    titulo: 'Por empleado (quien levantó la nota)',
    columnas: [{ etiqueta: 'Empleado' }, { etiqueta: 'Notas', fmt: ENTERO }, { etiqueta: 'Vendido', fmt: DINERO }, { etiqueta: 'Ticket promedio', fmt: DINERO }, { etiqueta: '% del total', fmt: PCT }, { etiqueta: 'Pendiente', fmt: DINERO }],
    filas: ana.empleados.map((e) => [e.nombre, e.notas, e.vendido, e.ticketPromedio, e.porcentaje, e.pendiente]),
  });
  tabla(an, {
    titulo: 'Por día de la semana',
    columnas: [{ etiqueta: 'Día' }, { etiqueta: 'Días contados', fmt: ENTERO }, { etiqueta: 'Notas', fmt: ENTERO }, { etiqueta: 'Vendido', fmt: DINERO }, { etiqueta: 'Promedio por día', fmt: DINERO }],
    filas: ana.diasSemana.dias.map((x) => ({ valores: [x.nombre + (x.dia === ana.diasSemana.mejor ? ' (mejor día)' : ''), x.veces, x.notas, x.vendido, x.veces ? x.promedio : null], negrita: x.dia === ana.diasSemana.mejor })),
  });
  tabla(an, {
    titulo: 'Clientes',
    columnas: [{ etiqueta: 'Grupo' }, { etiqueta: 'Cantidad', fmt: ENTERO }, { etiqueta: 'Vendido', fmt: DINERO }],
    filas: [
      ['Clientes nuevos (se registraron en el periodo)', ana.clientes.nuevos.clientes, ana.clientes.nuevos.vendido],
      ['Clientes que regresan', ana.clientes.recurrentes.clientes, ana.clientes.recurrentes.vendido],
      ['Ventas sin cliente registrado', ana.clientes.sinCliente.ventas, ana.clientes.sinCliente.vendido],
    ],
  });
  tabla(an, {
    titulo: 'Cancelaciones y devoluciones',
    columnas: [{ etiqueta: 'Concepto' }, { etiqueta: 'Operaciones', fmt: ENTERO }, { etiqueta: 'Cancelado', fmt: DINERO }, { etiqueta: 'Retenido', fmt: DINERO }, { etiqueta: 'Devuelto', fmt: DINERO }],
    filas: ana.cancelaciones.categorias.filter((x) => d.esLimpieza || x.id === 'devolucion').map((x) => [x.etiqueta, x.operaciones, x.cancelado, x.retenido, x.devuelto]),
  });
  tabla(an, {
    titulo: 'Motivos que más se repiten',
    columnas: [{ etiqueta: 'Motivo' }, { etiqueta: 'Veces', fmt: ENTERO }, { etiqueta: 'Devuelto', fmt: DINERO }],
    filas: ana.cancelaciones.motivos.map((m) => [m.motivo, m.veces, m.devuelto]),
  });
  if (d.esLimpieza) {
    tabla(an, {
      titulo: 'Cobranza: lo que se debe hoy',
      nota: 'Es la deuda de hoy, sin importar el periodo. La antigüedad cuenta desde que se levantó la nota.',
      columnas: [{ etiqueta: 'Antigüedad' }, { etiqueta: 'Notas', fmt: ENTERO }, { etiqueta: 'Monto', fmt: DINERO }],
      filas: ana.cobranza.rangos.map((r) => [r.etiqueta, r.notas, r.monto]),
    });
    tabla(an, {
      titulo: 'Las notas más atrasadas',
      columnas: [{ etiqueta: 'Folio' }, { etiqueta: 'Cliente' }, { etiqueta: 'Teléfono' }, { etiqueta: 'Sucursal' }, { etiqueta: 'Saldo', fmt: DINERO }, { etiqueta: 'Días', fmt: ENTERO }],
      filas: ana.cobranza.masAtrasadas.map((x) => [x.folio, x.cliente ?? 'Sin cliente', x.telefono ? fmt.telefono(x.telefono) : '', x.sucursal, x.saldo, x.dias]),
    });
  }
  tabla(an, {
    titulo: 'Descuentos por promociones',
    columnas: [{ etiqueta: 'Promoción' }, { etiqueta: 'Artículos', fmt: ENTERO }, { etiqueta: 'Importe', fmt: DINERO }],
    filas: ana.descuentos.promociones.map((x) => [x.nombre, x.veces, x.descuento]),
  });
  tabla(an, {
    titulo: 'Descuentos manuales (quién autorizó)',
    columnas: [{ etiqueta: 'Autorizó' }, { etiqueta: 'Artículos', fmt: ENTERO }, { etiqueta: 'Importe', fmt: DINERO }],
    filas: ana.descuentos.manuales.map((x) => [x.nombre, x.veces, x.descuento]),
  });
  anchosDe(an, [44, 16, 18, 18, 18, 14]);

  // ---------- Horas ----------
  const hh = wb.addWorksheet('Horas');
  tabla(hh, {
    titulo: 'Ventas por hora',
    nota: est.horas.horarioConfigurado ? 'Según el horario de la sucursal.' : 'Se usó el horario de 9:00 a 21:00 porque aún no hay horario configurado.',
    columnas: [{ etiqueta: 'Hora' }, { etiqueta: 'Abierta' }, { etiqueta: 'Sin ventas' }, ...est.horas.series.map((s) => ({ etiqueta: s.etiqueta, fmt: DINERO }))],
    filas: est.horas.filas.map((f) => [`${f.hora}:00`, f.abierta ? 'Sí' : 'No', f.sinVentas ? 'Sí' : '', ...est.horas.series.map((s) => f.valores[s.id] ?? 0)]),
  });
  anchosDe(hh, [12, 12, 12, 18, 30, 30, 30]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}