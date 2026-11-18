import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { normalizarTelefono } from '../utils/telefono.js';
import * as admins from '../repositories/adminsGlobales.repository.js';

const a = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((x) => x.startsWith('--') && x.includes('='))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(2, i), x.slice(i + 1)];
    })
);
const telefono = normalizarTelefono(a.telefono);

if (!a.nombre || a.nombre.length < 2) {
  console.error('Falta --nombre="Tu Nombre"');
  process.exit(1);
}
if (telefono.length !== 10) {
  console.error('El teléfono (--telefono) debe tener 10 dígitos.');
  process.exit(1);
}
if (!a.password || a.password.length < 8) {
  console.error('La contraseña (--password) debe tener al menos 8 caracteres.');
  process.exit(1);
}

try {
  const id = await admins.crear(pool, {
    nombre: a.nombre,
    telefono,
    passwordHash: await bcrypt.hash(a.password, 12),
  });
  console.log('Admin global creado, id:', id);
} catch (err) {
  console.error('No se pudo crear:', err.code === '23505' ? 'ese teléfono ya existe' : err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}