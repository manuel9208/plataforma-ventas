import { pool } from '../config/db.js';
import { guardarVariable } from '../utils/resolverVariables.js';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--') && a.includes('='))
    .map((a) => {
      const i = a.indexOf('=');
      return [a.slice(2, i), a.slice(i + 1)];
    })
);

if (!args.empresa || !args.clave || !args.valor) {
  console.error('Uso: npm run variable:set -- --empresa=<slug> --clave=<clave> --valor="<valor>" [--sucursal="<nombre>"]');
  process.exit(1);
}

try {
  const emp = await pool.query('SELECT id FROM empresas WHERE slug = $1', [args.empresa]);
  if (!emp.rows[0]) throw new Error('No existe la empresa ' + args.empresa);
  const empresaId = emp.rows[0].id;

  let sucursalId = null;
  if (args.sucursal) {
    const suc = await pool.query(
      'SELECT id FROM sucursales WHERE empresa_id = $1 AND nombre = $2',
      [empresaId, args.sucursal]
    );
    if (!suc.rows[0]) throw new Error('No existe la sucursal ' + args.sucursal);
    sucursalId = suc.rows[0].id;
  }

  await guardarVariable(empresaId, sucursalId, args.clave, args.valor);
  console.log('Guardada y cifrada:', args.clave, sucursalId ? '(sucursal)' : '(empresa)');
} catch (err) {
  console.error('No se pudo guardar:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}