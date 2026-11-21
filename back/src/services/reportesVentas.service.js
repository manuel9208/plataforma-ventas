import {
  aCentavos,
  aMonto,
  armarGraficaHoras,
  compararVentas,
  horasDeAtencion,
  metaDeVenta,
  periodosComparables,
  recortarComparables,
} from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { listarSucursalesPorIds } from '../repositories/usuarios.repository.js';
import * as repo from '../repositories/reportesVentas.repository.js';
import { hoy as hoyDeSucursal } from '../repositories/puntos.repository.js';
import { respuestaVentas } from '../serializers/reportesVentas.serializer.js';
import { detalleVenta as serializarDetalle, respuestaConsumo, resumenesPorVenta } from '../serializers/consumoVentas.serializer.js';

// Cada quien ve solo sus sucursales (administrador y gerente las que tienen asignadas; el AdminGlobal, todas)
function resolverSucursales(actor, pedidas) {
  if (!pedidas?.length) return actor.sucursales;
  const permitidas = new Set(actor.sucursales);
  if (pedidas.some((id) => !permitidas.has(id))) throw new ErrorHttp(403, 'No tienes acceso a una de esas sucursales');
  return [...new Set(pedidas)];
}

// Lo que la pantalla necesita para armar los filtros
export async function opciones(actor) {
  const [sucursales, empleados, hoy] = await Promise.all([
    listarSucursalesPorIds(pool, actor.empresaId, actor.sucursales),
    repo.listarEmpleados(pool, actor.empresaId, actor.sucursales),
    hoyDeSucursal(pool, actor.empresaId, actor.sucursales[0]),
  ]);
  return { hoy, sucursales, empleados: empleados.map((u) => ({ id: u.id, nombre: u.nombre, activo: u.activo })) };
}

export async function ventas(actor, q) {
  const e = actor.empresaId;
  const sucursales = resolverSucursales(actor, q.sucursales);
  if (!sucursales.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  const f = { desde: q.desde, hasta: q.hasta, empleadoId: q.empleadoId, estado: q.estado, giro: q.giro };

  const [filas, grupos, pagos, devoluciones, atras, nombres] = await Promise.all([
    repo.listar(pool, e, sucursales, f, { orden: q.orden, direccion: q.direccion, limite: q.limite, pagina: q.pagina }),
    repo.totalesPorSucursal(pool, e, sucursales, f),
    repo.dineroPorForma(pool, e, sucursales, f, 'pagos'),
    repo.dineroPorForma(pool, e, sucursales, f, 'reembolsos'),
    repo.porCobrarAnteriores(pool, e, sucursales, f),
    listarSucursalesPorIds(pool, e, sucursales),
  ]);

  const total = grupos.reduce((s, g) => s + Number(g.notas), 0);
  const resumenes = resumenesPorVenta(await repo.resumenArticulos(pool, e, filas.map((x) => x.id)));
  return respuestaVentas({ filas, grupos, pagos, devoluciones, atras, sucursales: nombres, consulta: q, total, resumenes });
}

const sumaDe = (grupos, clave) => grupos.reduce((s, g) => s + Math.round(aCentavos(Number(g[clave] ?? 0))), 0);

// Comparativa, meta y ventas por hora. Usa los mismos filtros del reporte.
export async function estadisticas(actor, _empresa, q) {
  const e = actor.empresaId;
  const sucursales = resolverSucursales(actor, q.sucursales);
  if (!sucursales.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  const f = { desde: q.desde, hasta: q.hasta, empleadoId: q.empleadoId, estado: q.estado, giro: q.giro };

  let comparables;
  try {
    comparables = periodosComparables(q.periodo, q.desde, q.hasta);
  } catch (err) {
    throw new ErrorHttp(400, err.message);
  }

  // Un periodo en curso se compara solo hasta el mismo día (si así se pidió)
  const hoy = await hoyDeSucursal(pool, e, sucursales[0]);
  const enCurso = q.desde <= hoy && hoy < q.hasta;
  const recortado = q.hastaHoy && enCurso;
  if (recortado) comparables = recortarComparables(comparables, q.desde, hoy);

  const periodos = [{ desde: q.desde, hasta: q.hasta }, ...comparables];

  const [totales, horas, metas, horarios] = await Promise.all([
    Promise.all(periodos.map((p) => repo.totalesPorSucursal(pool, e, sucursales, { ...f, desde: p.desde, hasta: p.hasta }))),
    Promise.all(periodos.map((p) => repo.ventasPorHora(pool, e, sucursales, { ...f, desde: p.desde, hasta: p.hasta }))),
    repo.metasCrecimiento(pool, e, sucursales),
    repo.horariosDeSucursales(pool, e, sucursales),
  ]);

  const vendidoActual = aMonto(sumaDe(totales[0], 'vendido'));
  const notasActual = totales[0].reduce((s, g) => s + Number(g.notas), 0);

  const comparativa = comparables.map((p, i) => {
    const vendido = aMonto(sumaDe(totales[i + 1], 'vendido'));
    return {
      id: p.id,
      etiqueta: p.etiqueta,
      desde: p.desde,
      hasta: p.hasta,
      vendido,
      notas: totales[i + 1].reduce((s, g) => s + Number(g.notas), 0),
      ...compararVentas(vendidoActual, vendido),
    };
  });

  // La meta parte del primer periodo de comparación; cada sucursal con su propio porcentaje
  const porcentajes = sucursales.map((id) => Number(metas.find((m) => Number(m.sucursal_id) === id)?.porcentaje ?? 5));
  const meta = {
    ...metaDeVenta(
      sucursales.map((id, i) => ({
        base: Number(totales[1].find((g) => Number(g.sucursal_id) === id)?.vendido ?? 0),
        porcentaje: porcentajes[i],
      })),
      vendidoActual
    ),
    contra: comparables[0].etiqueta,
    // null cuando las sucursales elegidas tienen porcentajes distintos
    porcentaje: new Set(porcentajes).size === 1 ? porcentajes[0] : null,
  };

  const atencion = horasDeAtencion(horarios, q.desde, q.hasta);
  const grafica = armarGraficaHoras({
    abiertas: atencion.abiertas,
    actual: horas[0],
    comparables: comparables.map((p, i) => ({ id: p.id, etiqueta: p.etiqueta, horas: horas[i + 1] })),
  });

  return {
    periodo: { desde: q.desde, hasta: q.hasta },
    actual: { vendido: vendidoActual, notas: notasActual },
    comparativa,
    meta,
    horas: { ...grafica, horarioConfigurado: atencion.configurado },
    // true cuando las comparaciones se recortaron a los mismos días
    recortado,
    enCurso,
  };
}

const LIMITE_SERVICIOS = 100;

// Qué se consumió (servicios, productos y extras) y qué no se vendió. Mismos filtros que la tabla.
export async function consumo(actor, empresa, q) {
  const e = actor.empresaId;
  const sucursales = resolverSucursales(actor, q.sucursales);
  if (!sucursales.length) throw new ErrorHttp(403, 'No tienes sucursales asignadas');
  const f = { desde: q.desde, hasta: q.hasta, empleadoId: q.empleadoId, estado: q.estado, giro: q.giro };
  const conServicios = empresa.tipo_negocio === 'limpieza';

  const [productos, servicios, extras, sinVentas] = await Promise.all([
    repo.consumoProductos(pool, e, sucursales, f, q.orden),
    conServicios ? repo.consumoServicios(pool, e, sucursales, f) : [],
    conServicios ? repo.consumoExtras(pool, e, sucursales, f, q.orden) : [],
    repo.sinVentas(pool, e, sucursales, f, { productos: q.giro !== 'servicios', servicios: conServicios && q.giro !== 'productos' }),
  ]);
  return { ...respuestaConsumo({ productos, servicios, extras, orden: q.orden, limite: LIMITE_SERVICIOS }), sinVentas };
}

// Lo que consumió una nota, solo si es de una sucursal del usuario
export async function detalleVenta(actor, id) {
  const d = await repo.detalleDeVenta(pool, actor.empresaId, actor.sucursales, id);
  if (!d) throw new ErrorHttp(404, 'Venta no encontrada');
  return serializarDetalle(d);
}