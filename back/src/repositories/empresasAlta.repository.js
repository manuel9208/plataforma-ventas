import { exigirEmpresa } from '../utils/tenant.js';

const ROLES_BASE = [
  ['administrador', 'Administrador', 1],
  ['gerente', 'Gerente', 2],
  ['jefe', 'Jefe', 3],
  ['cajero', 'Cajero', 4],
  ['auxiliar', 'Auxiliar', 5],
];

// empresas es una tabla global: aquí no hay empresaId todavía
export async function insertarEmpresa(db, e) {
  const r = await db.query(
    `INSERT INTO empresas (slug, nombre, tipo_negocio, zona_horaria, moneda, dominios_permitidos)
     VALUES ($1, $2, $3, $4, $5, $6::text[]) RETURNING id`,
    [e.slug, e.nombre, e.tipoNegocio, e.zonaHoraria, e.moneda, e.dominios]
  );
  return r.rows[0].id;
}

// Devuelve { administrador: id, gerente: id, ... }
export async function sembrarRoles(db, empresaId) {
  exigirEmpresa(empresaId);
  const ids = {};
  for (const [clave, nombre, nivel] of ROLES_BASE) {
    const r = await db.query(
      `INSERT INTO roles (empresa_id, clave, nombre, nivel_jerarquico) VALUES ($1, $2, $3, $4) RETURNING id`,
      [empresaId, clave, nombre, nivel]
    );
    ids[clave] = r.rows[0].id;
  }
  return ids;
}

// Sucursal con su configuración y su "Caja 1" (la misma siembra para el alta de empresa y de sucursal)
export async function sembrarSucursal(db, empresaId, nombre) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO sucursales (empresa_id, nombre, es_principal)
     VALUES ($1, $2, NOT EXISTS (SELECT 1 FROM sucursales WHERE empresa_id = $1 AND es_principal)) RETURNING id`,
    [empresaId, nombre]
  );
  const sucursalId = r.rows[0].id;
  await db.query(`INSERT INTO sucursal_config (empresa_id, sucursal_id) VALUES ($1, $2)`, [empresaId, sucursalId]);
  await db.query(`INSERT INTO cajas (empresa_id, sucursal_id, nombre) VALUES ($1, $2, 'Caja 1')`, [empresaId, sucursalId]);
  return sucursalId;
}

// El administrador nace con todos los permisos ("*"): solo el alta de empresa los siembra así
export async function insertarAdministrador(db, empresaId, a) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO usuarios (empresa_id, telefono, nombre, password_hash, pin_hash, rol_id, permisos)
     VALUES ($1, $2, $3, $4, $5, $6, '{"*": true}') RETURNING id`,
    [empresaId, a.telefono, a.nombre, a.passwordHash, a.pinHash, a.rolId]
  );
  return r.rows[0].id;
}

export async function asignarSucursal(db, empresaId, usuarioId, sucursalId) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO usuario_sucursales (empresa_id, usuario_id, sucursal_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [empresaId, usuarioId, sucursalId]
  );
}

export async function sembrarConfigEmpresa(db, empresaId) {
  exigirEmpresa(empresaId);
  await db.query(`INSERT INTO empresa_config (empresa_id) VALUES ($1) ON CONFLICT DO NOTHING`, [empresaId]);
  await db.query(
    `INSERT INTO tasas_iva (empresa_id, nombre, porcentaje, es_defecto)
     VALUES ($1, 'General', 16, TRUE), ($1, 'Tasa 0', 0, FALSE)`,
    [empresaId]
  );
}