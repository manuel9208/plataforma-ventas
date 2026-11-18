import { exigirEmpresa } from '../utils/tenant.js';

const COLUMNAS = `
  u.id, u.nombre, u.telefono, u.correo, u.direccion, u.activo, u.permisos, u.creado_en,
  u.fecha_ingreso, u.fecha_nacimiento,
  u.contacto_emergencia_nombre, u.contacto_emergencia_telefono,
  (u.pin_hash IS NOT NULL) AS tiene_pin,
  d.rfc_cifrado, d.nss_cifrado, d.curp_cifrado,
  r.id AS rol_id, r.clave AS rol_clave, r.nombre AS rol_nombre, r.nivel_jerarquico AS rol_nivel,
  (SELECT COALESCE(array_agg(x.sucursal_id ORDER BY x.sucursal_id), '{}')::int[]
     FROM usuario_sucursales x
     WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id) AS sucursal_ids`;

// Solo se ven usuarios de nivel mayor y con TODAS sus sucursales dentro de las del actor
// $1 empresa, $2 nivel del actor, $3 sucursales del actor
const BASE = `
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
  LEFT JOIN empleados_datos d ON d.usuario_id = u.id AND d.empresa_id = u.empresa_id
  WHERE u.empresa_id = $1
    AND r.nivel_jerarquico > $2
    AND EXISTS (SELECT 1 FROM usuario_sucursales x
                WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM usuario_sucursales x
                    WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id
                      AND x.sucursal_id <> ALL($3::bigint[]))`;

const COLUMNAS_EDITABLES = new Set([
  'nombre',
  'telefono',
  'correo',
  'direccion',
  'fecha_ingreso',
  'fecha_nacimiento',
  'contacto_emergencia_nombre',
  'contacto_emergencia_telefono',
  'rol_id',
  'permisos',
  'activo',
  'password_hash',
  'pin_hash',
]);

// ---------- Login y sesión ----------
export async function buscarParaLogin(db, empresaId, telefono) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, password_hash, activo FROM usuarios WHERE empresa_id = $1 AND telefono = $2`,
    [empresaId, telefono]
  );
  return r.rows[0] || null;
}

export async function cargarSesion(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT u.id, u.telefono, u.nombre, u.activo, u.permisos,
            r.clave AS rol, r.nivel_jerarquico AS nivel,
            (SELECT COALESCE(array_agg(x.sucursal_id ORDER BY x.sucursal_id), '{}')::int[]
               FROM usuario_sucursales x
               JOIN sucursales s ON s.id = x.sucursal_id AND s.empresa_id = x.empresa_id
               WHERE x.empresa_id = u.empresa_id AND x.usuario_id = u.id AND s.activo) AS sucursales
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id AND r.activo
     WHERE u.empresa_id = $1 AND u.id = $2`,
    [empresaId, usuarioId]
  );
  return r.rows[0] || null;
}

// ---------- Catálogos ----------
export async function listarSucursalesPorIds(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, nombre FROM sucursales
     WHERE empresa_id = $1 AND activo AND id = ANY($2::bigint[]) ORDER BY nombre`,
    [empresaId, ids]
  );
  return r.rows;
}

export async function contarSucursalesActivas(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) AS n FROM sucursales
     WHERE empresa_id = $1 AND activo AND id = ANY($2::bigint[])`,
    [empresaId, ids]
  );
  return r.rows[0].n;
}

export async function listarRolesAsignables(db, empresaId, nivelActor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, clave, nombre, nivel_jerarquico FROM roles
     WHERE empresa_id = $1 AND activo AND nivel_jerarquico > $2 ORDER BY nivel_jerarquico`,
    [empresaId, nivelActor]
  );
  return r.rows;
}

export async function buscarRol(db, empresaId, rolId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, clave, nombre, nivel_jerarquico, activo FROM roles
     WHERE empresa_id = $1 AND id = $2`,
    [empresaId, rolId]
  );
  return r.rows[0] || null;
}

// ---------- Usuarios ----------
export async function listar(db, empresaId, alcance, { buscar, activo, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, alcance.nivel, alcance.sucursales];
  let filtro = '';

  if (buscar) {
    params.push(`%${buscar.replace(/[\\%_]/g, '\\$&')}%`);
    filtro += ` AND (u.nombre ILIKE $${params.length} OR u.telefono ILIKE $${params.length})`;
  }
  if (activo !== undefined) {
    params.push(activo);
    filtro += ` AND u.activo = $${params.length}`;
  }

  const total = await db.query(`SELECT count(*) AS n ${BASE}${filtro}`, params);

  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS} ${BASE}${filtro}
     ORDER BY u.nombre, u.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: total.rows[0].n };
}

export async function obtener(db, empresaId, alcance, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${BASE} AND u.id = $4`, [
    empresaId,
    alcance.nivel,
    alcance.sucursales,
    id,
  ]);
  return r.rows[0] || null;
}

export async function insertar(db, empresaId, d) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO usuarios (
       empresa_id, nombre, telefono, correo, password_hash, pin_hash, rol_id, permisos,
       direccion, fecha_ingreso, fecha_nacimiento,
       contacto_emergencia_nombre, contacto_emergencia_telefono)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::date, CURRENT_DATE), $11, $12, $13)
     RETURNING id`,
    [
      empresaId,
      d.nombre,
      d.telefono,
      d.correo ?? null,
      d.passwordHash,
      d.pinHash,
      d.rolId,
      JSON.stringify(d.permisos),
      d.direccion ?? null,
      d.fechaIngreso ?? null,
      d.fechaNacimiento ?? null,
      d.contactoEmergenciaNombre ?? null,
      d.contactoEmergenciaTelefono ?? null,
    ]
  );
  return r.rows[0].id;
}

export async function actualizar(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => COLUMNAS_EDITABLES.has(c))) {
    throw new Error('Columnas no permitidas');
  }
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  const valores = claves.map((c) => (c === 'permisos' ? JSON.stringify(campos[c]) : campos[c]));
  await db.query(
    `UPDATE usuarios SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND id = $2`,
    [empresaId, id, ...valores]
  );
}

// Recibe los valores YA cifrados. Lo que viene vacío conserva el valor anterior.
export async function guardarDatosLaborales(db, empresaId, usuarioId, { rfc, nss, curp }) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO empleados_datos (empresa_id, usuario_id, rfc_cifrado, nss_cifrado, curp_cifrado)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id) DO UPDATE SET
       rfc_cifrado = COALESCE(EXCLUDED.rfc_cifrado, empleados_datos.rfc_cifrado),
       nss_cifrado = COALESCE(EXCLUDED.nss_cifrado, empleados_datos.nss_cifrado),
       curp_cifrado = COALESCE(EXCLUDED.curp_cifrado, empleados_datos.curp_cifrado),
       actualizado_en = now()
     WHERE empleados_datos.empresa_id = EXCLUDED.empresa_id`,
    [empresaId, usuarioId, rfc ?? null, nss ?? null, curp ?? null]
  );
}

export async function insertarSucursales(db, empresaId, usuarioId, sucursalIds) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO usuario_sucursales (empresa_id, usuario_id, sucursal_id)
     SELECT $1::bigint, $2::bigint, unnest($3::bigint[])`,
    [empresaId, usuarioId, sucursalIds]
  );
}

export async function reemplazarSucursales(db, empresaId, usuarioId, sucursalIds) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM usuario_sucursales WHERE empresa_id = $1 AND usuario_id = $2`, [
    empresaId,
    usuarioId,
  ]);
  await insertarSucursales(db, empresaId, usuarioId, sucursalIds);
}

export async function listarSucursalIdsActivas(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id FROM sucursales WHERE empresa_id = $1 AND activo ORDER BY id`, [empresaId]);
  return r.rows.map((x) => x.id);
}