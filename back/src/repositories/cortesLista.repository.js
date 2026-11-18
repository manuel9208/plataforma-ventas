import { exigirEmpresa } from '../utils/tenant.js';

const ZONA = 'COALESCE(s.zona_horaria, e.zona_horaria)';

// Cada corte es una foto fija tomada al cerrar el turno
const DESDE = `
  FROM turno_cortes c
  JOIN turnos t ON t.id = c.turno_id AND t.empresa_id = c.empresa_id
  JOIN cajas cj ON cj.id = c.caja_id AND cj.empresa_id = c.empresa_id
  JOIN sucursales s ON s.id = c.sucursal_id AND s.empresa_id = c.empresa_id
  JOIN empresas e ON e.id = c.empresa_id
  JOIN usuarios u ON u.id = t.usuario_id AND u.empresa_id = t.empresa_id
  LEFT JOIN usuarios uc ON uc.id = t.cerrado_por AND uc.empresa_id = t.empresa_id
  LEFT JOIN admins_globales ag ON ag.id = t.cerrado_por_global`;

// Los filtros salen de esta lista, nunca del usuario
const RESULTADOS = {
  cuadra: 'AND NOT c.sin_conteo AND c.diferencia = 0',
  sobra: 'AND c.diferencia > 0',
  falta: 'AND c.diferencia < 0',
  sin_conteo: 'AND c.sin_conteo',
};

// $1 empresa, $2 sucursales del actor
export async function listar(db, empresaId, sucursales, { desde, hasta, resultado, limite, pagina }) {
  exigirEmpresa(empresaId);
  if (resultado && !RESULTADOS[resultado]) throw new Error('Resultado desconocido');
  const params = [empresaId, sucursales];
  let filtro = '';
  if (desde) {
    params.push(desde);
    filtro += ` AND t.fecha_operativa >= $${params.length}::date`;
  }
  if (hasta) {
    params.push(hasta);
    filtro += ` AND t.fecha_operativa <= $${params.length}::date`;
  }
  if (resultado) filtro += ` ${RESULTADOS[resultado]}`;
  const donde = ` WHERE c.empresa_id = $1 AND c.sucursal_id = ANY($2::bigint[])${filtro}`;

  const resumen = await db.query(
    `SELECT count(*) AS n,
            COALESCE(sum(c.diferencia) FILTER (WHERE c.diferencia < 0), 0) AS faltante,
            COALESCE(sum(c.diferencia) FILTER (WHERE c.diferencia > 0), 0) AS sobrante,
            count(*) FILTER (WHERE c.sin_conteo) AS sin_conteo
     ${DESDE}${donde}`,
    params
  );

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT c.turno_id, c.sin_conteo, c.esperado, c.contado, c.diferencia, c.entregado,
            t.fecha_operativa, t.cerrado_en, t.cierre_tardio,
            cj.nombre AS caja, s.nombre AS sucursal, u.nombre AS cajero, ${ZONA} AS zona
     ${DESDE}${donde}
     ORDER BY t.cerrado_en DESC, c.turno_id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const r = resumen.rows[0];
  return {
    filas: filas.rows,
    total: r.n,
    resumen: { faltante: Number(r.faltante), sobrante: Number(r.sobrante), sinConteo: r.sin_conteo },
  };
}

// Un corte completo, solo si es de una sucursal del usuario
export async function obtener(db, empresaId, sucursales, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT c.turno_id, c.sin_conteo, c.fondo_inicial,
            c.cobros_efectivo, c.cobros_tarjeta, c.cobros_transferencia,
            c.reembolsos_efectivo, c.reembolsos_tarjeta, c.reembolsos_transferencia,
            c.gastos, c.retiros, c.esperado, c.contado, c.diferencia, c.dejado, c.entregado,
            t.fecha_operativa, t.abierto_en, t.cerrado_en, t.cierre_tardio,
            cj.nombre AS caja, s.nombre AS sucursal, u.nombre AS cajero,
            COALESCE(uc.nombre, CASE WHEN ag.id IS NOT NULL THEN 'Administrador global' END) AS cerro,
            ${ZONA} AS zona
     ${DESDE}
     WHERE c.empresa_id = $1 AND c.turno_id = $2 AND c.sucursal_id = ANY($3::bigint[])`,
    [empresaId, turnoId, sucursales]
  );
  return r.rows[0] || null;
}

// Cancelaciones y reembolsos hechos durante el turno (con la forma en que se devolvió el dinero)
export async function ajustesDeTurno(db, empresaId, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT a.id, a.tipo, a.motivo, a.valor_cancelado, a.devuelto, a.retenido, a.creado_en,
            EXISTS (SELECT 1 FROM venta_devoluciones d WHERE d.empresa_id = a.empresa_id AND d.ajuste_id = a.id) AS es_devolucion,
            v.folio, u.nombre AS hizo, au.nombre AS autorizo, rb.forma
     FROM venta_ajustes a
     JOIN ventas v ON v.id = a.venta_id AND v.empresa_id = a.empresa_id
     JOIN usuarios u ON u.id = a.usuario_id AND u.empresa_id = a.empresa_id
     LEFT JOIN usuarios au ON au.id = a.autorizado_por AND au.empresa_id = a.empresa_id
     LEFT JOIN venta_reembolsos rb ON rb.ajuste_id = a.id AND rb.empresa_id = a.empresa_id
     WHERE a.empresa_id = $1 AND a.turno_id = $2
     ORDER BY a.creado_en, a.id LIMIT 200`,
    [empresaId, turnoId]
  );
  return r.rows;
}

// Cuántas ventas y notas se levantaron en el turno
export async function ventasDeTurno(db, empresaId, turnoId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) AS n, count(*) FILTER (WHERE tiene_servicios) AS notas
     FROM ventas WHERE empresa_id = $1 AND turno_id = $2`,
    [empresaId, turnoId]
  );
  return { total: r.rows[0].n, notas: r.rows[0].notas };
}