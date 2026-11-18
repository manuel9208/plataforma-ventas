import { exigirEmpresa } from '../utils/tenant.js';

// Zona horaria de la sucursal (si no tiene, la de la empresa)
const ZONA = 'COALESCE(s.zona_horaria, e.zona_horaria)';

const SELECT_TURNO = `
  SELECT t.id, t.sucursal_id, t.caja_id, t.usuario_id, t.fondo_inicial, t.fecha_operativa,
         t.abierto_en, t.cerrado_en, t.cierre_tardio,
         u.nombre AS usuario_nombre, c.nombre AS caja_nombre, s.nombre AS sucursal_nombre,
         ${ZONA} AS zona,
         ((now() AT TIME ZONE ${ZONA})::date > t.fecha_operativa) AS de_otro_dia,
         (t.cerrado_en AT TIME ZONE ${ZONA})::date AS cierre_fecha_local
  FROM turnos t
  JOIN usuarios u ON u.id = t.usuario_id AND u.empresa_id = t.empresa_id
  JOIN cajas c ON c.id = t.caja_id AND c.empresa_id = t.empresa_id
  JOIN sucursales s ON s.id = t.sucursal_id AND s.empresa_id = t.empresa_id
  JOIN empresas e ON e.id = t.empresa_id`;

export async function turnoAbiertoDeUsuario(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`${SELECT_TURNO} WHERE t.empresa_id = $1 AND t.usuario_id = $2 AND t.cerrado_en IS NULL`, [
    empresaId,
    usuarioId,
  ]);
  return r.rows[0] || null;
}

export async function turnoAbiertoDeCaja(db, empresaId, cajaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`${SELECT_TURNO} WHERE t.empresa_id = $1 AND t.caja_id = $2 AND t.cerrado_en IS NULL`, [
    empresaId,
    cajaId,
  ]);
  return r.rows[0] || null;
}

export async function obtenerTurno(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`${SELECT_TURNO} WHERE t.empresa_id = $1 AND t.id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function listarAbiertos(db, empresaId, sucursales) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `${SELECT_TURNO}
     WHERE t.empresa_id = $1 AND t.sucursal_id = ANY($2::bigint[]) AND t.cerrado_en IS NULL
     ORDER BY t.abierto_en LIMIT 100`,
    [empresaId, sucursales]
  );
  return r.rows;
}

// La caja asignada al usuario, con su sucursal y zona horaria
export async function cajaAsignada(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT c.id AS caja_id, c.nombre AS caja_nombre, c.activo AS caja_activa,
            c.sucursal_id, s.nombre AS sucursal_nombre, s.activo AS sucursal_activa,
            ${ZONA} AS zona
     FROM caja_usuarios cu
     JOIN cajas c ON c.id = cu.caja_id AND c.empresa_id = cu.empresa_id
     JOIN sucursales s ON s.id = c.sucursal_id AND s.empresa_id = c.empresa_id
     JOIN empresas e ON e.id = c.empresa_id
     WHERE cu.empresa_id = $1 AND cu.usuario_id = $2`,
    [empresaId, usuarioId]
  );
  return r.rows[0] || null;
}

// Lo que el turno anterior de esa caja dejó para el día siguiente (se llena en el corte)
export async function ultimoDejado(db, empresaId, cajaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT dejado_manana FROM turnos
     WHERE empresa_id = $1 AND caja_id = $2 AND cerrado_en IS NOT NULL
     ORDER BY cerrado_en DESC LIMIT 1`,
    [empresaId, cajaId]
  );
  const v = r.rows[0]?.dejado_manana;
  return v === null || v === undefined ? null : Number(v);
}

export async function insertarTurno(db, empresaId, d) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO turnos (empresa_id, sucursal_id, caja_id, usuario_id, fondo_inicial, fecha_operativa)
     VALUES ($1, $2, $3, $4, $5, (now() AT TIME ZONE $6::text)::date)
     RETURNING id`,
    [empresaId, d.sucursalId, d.cajaId, d.usuarioId, d.fondoInicial, d.zona]
  );
  return r.rows[0].id;
}

// Cierra el turno con la fecha del día en que se abrió; si ya pasó ese día queda marcado como tardío
export async function cerrarTurno(db, empresaId, id, cerradoPor, cerradoPorGlobal, conteo = {}) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE turnos t
     SET cerrado_en = now(), cerrado_por = $3, cerrado_por_global = $4,
         efectivo_contado = $5, entregado_duenos = $6, dejado_manana = $7,
         cierre_tardio = ((now() AT TIME ZONE COALESCE(s.zona_horaria, e.zona_horaria))::date > t.fecha_operativa)
     FROM sucursales s, empresas e
     WHERE t.empresa_id = $1 AND t.id = $2 AND t.cerrado_en IS NULL
       AND s.id = t.sucursal_id AND s.empresa_id = t.empresa_id AND e.id = t.empresa_id
     RETURNING t.id`,
    [empresaId, id, cerradoPor, cerradoPorGlobal, conteo.contado ?? null, conteo.entregado ?? null, conteo.dejado ?? null]
  );
  return r.rowCount > 0;
}