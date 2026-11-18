import { pool, conTransaccion } from '../config/db.js';
import { normalizarTelefono } from '../utils/telefono.js';

const a = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((x) => x.startsWith('--') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(2, i), x.slice(i + 1)];
    })
);

if (!a.empresa || !a.nombre) {
  console.error(
    'Uso: npm run sucursal:crear -- --empresa=<slug> --nombre="Nombre" [--direccion="..."] [--zona=America/Mexico_City] [--asignar=6670000000,6671111111]'
  );
  process.exit(1);
}

if (a.zona) {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: a.zona });
  } catch {
    console.error('Zona horaria inválida: ' + a.zona);
    process.exit(1);
  }
}

const telefonos = (a.asignar || '').split(',').map(normalizarTelefono).filter(Boolean);

try {
  const r = await conTransaccion(async (db) => {
    const emp = await db.query('SELECT id FROM empresas WHERE slug = $1', [a.empresa]);
    if (!emp.rows[0]) throw new Error('No existe la empresa ' + a.empresa);
    const empresaId = emp.rows[0].id;

    const suc = await db.query(
      `INSERT INTO sucursales (empresa_id, nombre, direccion, zona_horaria)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [empresaId, a.nombre, a.direccion || null, a.zona || null]
    );
    const sucursalId = suc.rows[0].id;
    await db.query(`INSERT INTO sucursal_config (empresa_id, sucursal_id) VALUES ($1, $2)`, [empresaId, sucursalId]);
    await db.query(`INSERT INTO cajas (empresa_id, sucursal_id, nombre) VALUES ($1, $2, 'Caja 1')`, [empresaId, sucursalId]);

    for (const tel of telefonos) {
      const u = await db.query('SELECT id FROM usuarios WHERE empresa_id = $1 AND telefono = $2', [empresaId, tel]);
      if (!u.rows[0]) throw new Error('No existe un usuario con el teléfono ' + tel);
      await db.query(
        `INSERT INTO usuario_sucursales (empresa_id, usuario_id, sucursal_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [empresaId, u.rows[0].id, sucursalId]
      );
    }
    return { sucursalId };
  });
  console.log(`Sucursal creada (id ${r.sucursalId}).`, telefonos.length ? `Asignada a: ${telefonos.join(', ')}` : '');
} catch (err) {
  console.error('No se pudo crear la sucursal:', err.code === '23505' ? 'ya existe una sucursal con ese nombre' : err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}