import { pool } from '../config/db.js';

export async function verificarConexion() {
  await pool.query('SELECT 1');
}