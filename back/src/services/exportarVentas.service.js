import { COLUMNAS_POR_DEFECTO, COLUMNAS_REPORTE, COLUMNAS_SOLO_LIMPIEZA, ESTADOS_REPORTE, GIROS_REPORTE } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { crearFormato } from '../utils/formatoReporte.js';
import { construirPdf } from '../utils/reporteVentasPdf.js';
import { construirExcel } from '../utils/reporteVentasExcel.js';
import * as repo from '../repositories/reportesVentas.repository.js';
import * as reporte from './reportesVentas.service.js';

const MAX_FILAS = 5000;
const TIPOS = {
  pdf: { tipo: 'application/pdf', extension: 'pdf' },
  excel: { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
};
const PREFIJO = { dia: '', semana: 'Semana: ', mes: 'Mes: ', anio: 'Año: ', rango: 'Periodo: ' };

// Una descarga a la vez por usuario: armar el archivo es pesado
const enCurso = new Set();

export async function exportar(actor, empresa, formato, q, ip) {
  const salida = TIPOS[formato];
  const e = actor.empresaId;
  const clave = `${e}:${actor.esGlobal ? 'g' : 'u'}${actor.id ?? actor.adminGlobalId}`;
  if (enCurso.has(clave)) throw new ErrorHttp(429, 'Ya estás descargando un reporte. Espera a que termine.');
  enCurso.add(clave);

  try {
    const esLimpieza = empresa.tipo_negocio === 'limpieza';
    const base = { desde: q.desde, hasta: q.hasta, sucursales: q.sucursales, empleadoId: q.empleadoId, estado: q.estado, giro: q.giro };

    // Todo sale de las mismas funciones que usa la pantalla: las cifras nunca pueden diferir
    const [rep, est, con, ana, opc] = await Promise.all([
      reporte.ventas(actor, { ...base, orden: q.orden, direccion: q.direccion, limite: MAX_FILAS, pagina: 1 }),
      reporte.estadisticas(actor, empresa, { ...base, periodo: q.periodo, hastaHoy: q.hastaHoy }),
      reporte.consumo(actor, empresa, { ...base, orden: q.ordenConsumo }),
      reporte.analisis(actor, empresa, base),
      q.empleadoId ? reporte.opciones(actor) : null,
    ]);

    const idsSucursal = rep.porSucursal.map((s) => s.sucursalId);
    const zona = await repo.zonaDeSucursal(pool, e, idsSucursal[0] ?? actor.sucursales[0]);
    const moneda = empresa.moneda ?? 'MXN';
    const fmt = crearFormato(moneda);

    // Las columnas que eligió la persona, en el orden de siempre; sin servicios se quitan las que no aplican
    const pedidas = q.columnas?.length ? q.columnas : COLUMNAS_POR_DEFECTO;
    let columnas = COLUMNAS_REPORTE.filter((c) => pedidas.includes(c.id) && (esLimpieza || !COLUMNAS_SOLO_LIMPIEZA.includes(c.id)));
    if (!columnas.length) columnas = COLUMNAS_REPORTE.filter((c) => c.defecto);

    const filtros = [];
    if (q.estado !== 'todas') filtros.push(`Tipo de nota: ${ESTADOS_REPORTE.find((x) => x.id === q.estado)?.etiqueta}`);
    if (q.giro !== 'todo') filtros.push(`Qué se vendió: ${GIROS_REPORTE.find((x) => x.id === q.giro)?.etiqueta}`);
    if (q.empleadoId) filtros.push(`Empleado: ${opc?.empleados.find((x) => x.id === q.empleadoId)?.nombre ?? q.empleadoId}`);

    const datos = {
      empresa: empresa.nombre,
      moneda,
      esLimpieza,
      giro: q.giro,
      quien: actor.nombre ?? 'Administrador',
      generado: fmt.fechaHora(new Date().toISOString(), zona),
      desde: q.desde,
      hasta: q.hasta,
      periodoTexto:
        q.desde === q.hasta ? fmt.fechaLarga(q.desde) : `${PREFIJO[q.periodo] ?? ''}${fmt.fechaLarga(q.desde)} al ${fmt.fechaLarga(q.hasta)}`,
      sucursales: rep.porSucursal.map((s) => s.sucursal),
      filtrosTexto: filtros.length ? filtros.join(' · ') : 'Sin filtros adicionales',
      columnas,
      truncado: rep.total > rep.datos.length,
      rep,
      est,
      con,
      ana,
    };

    const buffer = formato === 'pdf' ? await construirPdf(datos) : await construirExcel(datos);

    // Cada descarga queda registrada: quién, qué periodo y cuántas filas
    await registrarBitacora(pool, {
      empresaId: e,
      usuarioId: actor.esGlobal ? null : actor.id,
      adminGlobalId: actor.adminGlobalId,
      accion: 'reporte.exportar',
      entidad: 'reporte_ventas',
      despues: {
        formato,
        periodo: q.periodo,
        desde: q.desde,
        hasta: q.hasta,
        sucursales: idsSucursal,
        filas: rep.datos.length,
        total: rep.total,
        columnas: columnas.map((c) => c.id),
      },
      ip,
    });

    return { buffer, tipo: salida.tipo, nombre: `reporte-ventas_${q.desde}_${q.hasta}.${salida.extension}` };
  } finally {
    enCurso.delete(clave);
  }
}