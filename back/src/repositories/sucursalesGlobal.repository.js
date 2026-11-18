import { exigirEmpresa } from '../utils/tenant.js';

const COLUMNAS = `
  s.id, s.nombre, s.direccion, s.zona_horaria, s.activo, s.baja_motivo, s.baja_en, s.creado_en,
  (SELECT count(*) FROM cajas c WHERE c.empresa_id = s.empresa_id AND c.sucursal_id = s.id AND c.activo) AS cajas,
  (SELECT count(*) FROM usuario_sucursales x WHERE x.empresa_id = s.empresa_id AND x.sucursal_id = s.id) AS empleados`;

export async function listar(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} FROM sucursales s WHERE s.empresa_id = $1 ORDER BY s.activo DESC, s.nombre, s.id`, [empresaId]);
  return r.rows;
}

export async function obtener(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} FROM sucursales s WHERE s.empresa_id = $1 AND s.id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

// Las columnas salen de esta lista, nunca del usuario
const EDITABLES = new Set(['nombre', 'direccion', 'zona_horaria']);

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE sucursales SET ${sets} WHERE empresa_id = $1 AND id = $2`, [empresaId, id, ...claves.map((c) => campos[c])]);
}

// Crear la sucursal con su configuración y su "Caja 1" vive en empresasAlta.repository.js (sembrarSucursal)

export async function sucursalesActivas(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT count(*) AS n FROM sucursales WHERE empresa_id = $1 AND activo`, [empresaId]);
  return r.rows[0].n;
}

export async function turnosAbiertos(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT count(*) AS n FROM turnos WHERE empresa_id = $1 AND sucursal_id = $2 AND cerrado_en IS NULL`, [
    empresaId,
    sucursalId,
  ]);
  return r.rows[0].n;
}

// Empleados activos que solo tienen esta sucursal: si se da de baja se quedarían sin dónde trabajar
export async function empleadosSoloAqui(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) AS n
     FROM usuarios u
     JOIN usuario_sucursales x ON x.empresa_id = u.empresa_id AND x.usuario_id = u.id AND x.sucursal_id = $2
     WHERE u.empresa_id = $1 AND u.activo
       AND NOT EXISTS (SELECT 1 FROM usuario_sucursales o
                       JOIN sucursales so ON so.id = o.sucursal_id AND so.empresa_id = o.empresa_id AND so.activo
                       WHERE o.empresa_id = u.empresa_id AND o.usuario_id = u.id AND o.sucursal_id <> $2)`,
    [empresaId, sucursalId]
  );
  return r.rows[0].n;
}

// Devuelve false si ya estaba de baja
export async function darDeBaja(db, empresaId, id, motivo, adminGlobalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE sucursales SET activo = FALSE, baja_motivo = $3, baja_en = now(), baja_por_global = $4
     WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, id, motivo, adminGlobalId]
  );
  return r.rowCount > 0;
}

// Devuelve false si ya estaba activa
export async function reactivar(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE sucursales SET activo = TRUE, baja_motivo = NULL, baja_en = NULL, baja_por_global = NULL
     WHERE empresa_id = $1 AND id = $2 AND NOT activo`,
    [empresaId, id]
  );
  return r.rowCount > 0;
}

// Los administradores de la empresa reciben la sucursal nueva para poder verla
export async function asignarAAdministradores(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO usuario_sucursales (empresa_id, usuario_id, sucursal_id)
     SELECT u.empresa_id, u.id, $2
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id AND r.clave = 'administrador'
     WHERE u.empresa_id = $1 AND u.activo
     ON CONFLICT DO NOTHING`,
    [empresaId, sucursalId]
  );
  return r.rowCount;
}