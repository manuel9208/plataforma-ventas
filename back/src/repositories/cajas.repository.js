import { exigirEmpresa } from '../utils/tenant.js';

const COLUMNAS = `
  c.id, c.sucursal_id, s.nombre AS sucursal_nombre, c.nombre, c.activo,
  c.ancho_papel, c.corte_automatico, c.abrir_cajon, c.imprimir_area,
  (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'nombre', u.nombre) ORDER BY u.nombre), '[]'::json)
     FROM caja_usuarios cu
     JOIN usuarios u ON u.id = cu.usuario_id AND u.empresa_id = cu.empresa_id
     WHERE cu.empresa_id = c.empresa_id AND cu.caja_id = c.id) AS usuarios,
  (SELECT json_build_object('usuario', u.nombre, 'desde', t.abierto_en)
     FROM turnos t
     JOIN usuarios u ON u.id = t.usuario_id AND u.empresa_id = t.empresa_id
     WHERE t.empresa_id = c.empresa_id AND t.caja_id = c.id AND t.cerrado_en IS NULL) AS turno_abierto`;

// $1 empresa, $2 sucursales del actor
const FROM = `
  FROM cajas c
  JOIN sucursales s ON s.id = c.sucursal_id AND s.empresa_id = c.empresa_id
  WHERE c.empresa_id = $1 AND c.sucursal_id = ANY($2::bigint[])`;

const EDITABLES = new Set(['nombre', 'activo', 'ancho_papel', 'corte_automatico', 'abrir_cajon', 'imprimir_area']);

export async function listar(db, empresaId, sucursales, { sucursalId, activo }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';
  if (sucursalId !== undefined) {
    params.push(sucursalId);
    filtro += ` AND c.sucursal_id = $${params.length}`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND c.activo = $${params.length}`;
  }
  const r = await db.query(`SELECT ${COLUMNAS} ${FROM}${filtro} ORDER BY s.nombre, c.nombre LIMIT 200`, params);
  return r.rows;
}

export async function obtener(db, empresaId, sucursales, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${FROM} AND c.id = $3`, [empresaId, sucursales, id]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, { sucursalId, nombre }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO cajas (empresa_id, sucursal_id, nombre) VALUES ($1, $2, $3) RETURNING id`,
    [empresaId, sucursalId, nombre]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE cajas SET ${sets} WHERE empresa_id = $1 AND id = $2`, [
    empresaId,
    id,
    ...claves.map((c) => campos[c]),
  ]);
}

export async function contarUsuarios(db, empresaId, cajaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT count(*) AS n FROM caja_usuarios WHERE empresa_id = $1 AND caja_id = $2`, [
    empresaId,
    cajaId,
  ]);
  return r.rows[0].n;
}

// Empleados activos de la sucursal a los que el actor les puede asignar caja (de nivel mayor al suyo, o él mismo)
export async function listarUsuariosAsignables(db, empresaId, sucursalId, nivelActor, actorId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT u.id, u.nombre, r.nombre AS rol, cu.caja_id
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
     JOIN usuario_sucursales us ON us.usuario_id = u.id AND us.empresa_id = u.empresa_id AND us.sucursal_id = $2
     LEFT JOIN caja_usuarios cu ON cu.usuario_id = u.id AND cu.empresa_id = u.empresa_id
     WHERE u.empresa_id = $1 AND u.activo AND (r.nivel_jerarquico > $3 OR u.id = $4::bigint)
     ORDER BY u.nombre LIMIT 200`,
    [empresaId, sucursalId, nivelActor, actorId]
  );
  return r.rows;
}

export async function buscarUsuarioParaCaja(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT u.id, u.nombre, u.activo, r.nivel_jerarquico AS nivel, cu.caja_id,
            (SELECT COALESCE(array_agg(x.sucursal_id), '{}')::int[]
               FROM usuario_sucursales x
               WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id) AS sucursal_ids
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
     LEFT JOIN caja_usuarios cu ON cu.usuario_id = u.id AND cu.empresa_id = u.empresa_id
     WHERE u.empresa_id = $1 AND u.id = $2`,
    [empresaId, usuarioId]
  );
  return r.rows[0] || null;
}

export async function asignar(db, empresaId, usuarioId, cajaId) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO caja_usuarios (empresa_id, usuario_id, caja_id) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id) DO UPDATE SET caja_id = EXCLUDED.caja_id, asignado_en = now()
     WHERE caja_usuarios.empresa_id = EXCLUDED.empresa_id`,
    [empresaId, usuarioId, cajaId]
  );
}

export async function quitarAsignacion(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM caja_usuarios WHERE empresa_id = $1 AND usuario_id = $2`, [empresaId, usuarioId]);
}

// Impresión de la caja asignada al empleado (la Caja la usa para armar sus tickets)
export async function impresionDeUsuario(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT c.ancho_papel, c.corte_automatico, c.abrir_cajon, c.imprimir_area
     FROM caja_usuarios cu
     JOIN cajas c ON c.id = cu.caja_id AND c.empresa_id = cu.empresa_id
     WHERE cu.empresa_id = $1 AND cu.usuario_id = $2`,
    [empresaId, usuarioId]
  );
  return r.rows[0] || null;
}