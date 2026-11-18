import pg from 'pg';
import { env } from './env.js';

// Los ids (BIGINT) llegan como número, no como texto
pg.types.setTypeParser(20, (v) => Number(v));
// Las fechas (DATE) llegan como texto "2026-11-12", sin cambios de zona horaria
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('[db] error en conexión inactiva:', err.message));

// Ejecuta varias consultas en una sola transacción
export async function conTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}