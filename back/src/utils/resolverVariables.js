import { pool } from '../config/db.js';
import { cifrar, descifrar } from './cifrado.js';

// Orden: sucursal -> empresa -> .env global
export async function resolverVariable(empresaId, sucursalId, clave) {
  if (!empresaId) throw new Error('resolverVariable exige empresaId');

  if (sucursalId) {
    const s = await pool.query(
      `SELECT valor_cifrado FROM variables_sucursal
       WHERE empresa_id = $1 AND sucursal_id = $2 AND clave = $3`,
      [empresaId, sucursalId, clave]
    );
    if (s.rows[0]) return descifrar(s.rows[0].valor_cifrado);
  }

  const e = await pool.query(
    `SELECT valor_cifrado FROM variables_empresa WHERE empresa_id = $1 AND clave = $2`,
    [empresaId, clave]
  );
  if (e.rows[0]) return descifrar(e.rows[0].valor_cifrado);

  return process.env[clave.toUpperCase()] || null;
}

export async function guardarVariable(empresaId, sucursalId, clave, valor) {
  if (!empresaId) throw new Error('guardarVariable exige empresaId');
  const cifrado = cifrar(valor);

  if (sucursalId) {
    await pool.query(
      `INSERT INTO variables_sucursal (empresa_id, sucursal_id, clave, valor_cifrado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sucursal_id, clave)
       DO UPDATE SET valor_cifrado = EXCLUDED.valor_cifrado, actualizado_en = now()`,
      [empresaId, sucursalId, clave, cifrado]
    );
    return;
  }

  await pool.query(
    `INSERT INTO variables_empresa (empresa_id, clave, valor_cifrado)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, clave)
     DO UPDATE SET valor_cifrado = EXCLUDED.valor_cifrado, actualizado_en = now()`,
    [empresaId, clave, cifrado]
  );
}