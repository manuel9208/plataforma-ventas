import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../config/db.js';

const carpeta = path.dirname(fileURLToPath(import.meta.url));
const texto = await readFile(path.join(carpeta, 'schema.sql'), 'utf8');

const sentencias = texto
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

let fallos = 0;
for (const [i, sentencia] of sentencias.entries()) {
  try {
    await pool.query(sentencia);
    console.log(`OK    [${i + 1}/${sentencias.length}]`);
  } catch (err) {
    fallos++;
    console.error(`ERROR [${i + 1}/${sentencias.length}]: ${err.message}`);
    console.error('      ' + sentencia.split('\n')[0]);
  }
}

await pool.end();
console.log(fallos ? `Terminó con ${fallos} error(es).` : 'Base de datos al día.');
process.exit(fallos ? 1 : 0);