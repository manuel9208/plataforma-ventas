import { exigirEmpresa } from '../utils/tenant.js';

// El catálogo es global (sin empresa). Los valores sí son de una empresa o de una sucursal.
export async function listarGrupos(db) {
  const r = await db.query(
    `SELECT grupo, nombre, descripcion, ayuda, nivel, selector_clave, modulo, orden
     FROM catalogo_variable_grupos ORDER BY orden, grupo`
  );
  return r.rows;
}

export async function listarVariables(db) {
  const r = await db.query(
    `SELECT clave, grupo, descripcion, es_secreto, etiqueta, orden, tipo, opciones, defecto, visible_si
     FROM catalogo_variables ORDER BY grupo, orden, clave`
  );
  return r.rows;
}

export async function listarSucursales(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, nombre FROM sucursales WHERE empresa_id = $1 AND activo ORDER BY nombre`, [empresaId]);
  return r.rows;
}

export async function sucursalActiva(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id FROM sucursales WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, sucursalId]);
  return r.rowCount > 0;
}

// Devuelven un Map clave -> valor cifrado
export async function valoresEmpresa(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT clave, valor_cifrado FROM variables_empresa WHERE empresa_id = $1`, [empresaId]);
  return new Map(r.rows.map((f) => [f.clave, f.valor_cifrado]));
}

export async function valoresSucursal(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT clave, valor_cifrado FROM variables_sucursal WHERE empresa_id = $1 AND sucursal_id = $2`, [
    empresaId,
    sucursalId,
  ]);
  return new Map(r.rows.map((f) => [f.clave, f.valor_cifrado]));
}

export async function guardarValor(db, empresaId, sucursalId, clave, cifrado) {
  exigirEmpresa(empresaId);
  if (sucursalId) {
    await db.query(
      `INSERT INTO variables_sucursal (empresa_id, sucursal_id, clave, valor_cifrado) VALUES ($1, $2, $3, $4)
       ON CONFLICT (sucursal_id, clave) DO UPDATE SET valor_cifrado = EXCLUDED.valor_cifrado, actualizado_en = now()`,
      [empresaId, sucursalId, clave, cifrado]
    );
    return;
  }
  await db.query(
    `INSERT INTO variables_empresa (empresa_id, clave, valor_cifrado) VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, clave) DO UPDATE SET valor_cifrado = EXCLUDED.valor_cifrado, actualizado_en = now()`,
    [empresaId, clave, cifrado]
  );
}

// Devuelve cuántas borró
export async function borrarValores(db, empresaId, sucursalId, claves) {
  exigirEmpresa(empresaId);
  if (!claves.length) return 0;
  const r = sucursalId
    ? await db.query(`DELETE FROM variables_sucursal WHERE empresa_id = $1 AND sucursal_id = $2 AND clave = ANY($3::text[])`, [
        empresaId,
        sucursalId,
        claves,
      ])
    : await db.query(`DELETE FROM variables_empresa WHERE empresa_id = $1 AND clave = ANY($2::text[])`, [empresaId, claves]);
  return r.rowCount;
}

export async function obtenerCifrado(db, empresaId, sucursalId, clave) {
  exigirEmpresa(empresaId);
  const r = sucursalId
    ? await db.query(`SELECT valor_cifrado FROM variables_sucursal WHERE empresa_id = $1 AND sucursal_id = $2 AND clave = $3`, [
        empresaId,
        sucursalId,
        clave,
      ])
    : await db.query(`SELECT valor_cifrado FROM variables_empresa WHERE empresa_id = $1 AND clave = $2`, [empresaId, clave]);
  return r.rows[0]?.valor_cifrado ?? null;
}