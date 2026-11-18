import { pool } from '../config/db.js';
import { crearEmpresaBody } from '../validators/empresasGlobal.validator.js';
import { altaEmpresa } from '../services/empresasGlobal.service.js';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--') && a.includes('='))
    .map((a) => {
      const i = a.indexOf('=');
      return [a.slice(2, i), a.slice(i + 1)];
    })
);

const requeridos = ['slug', 'nombre', 'tipo', 'zona', 'moneda', 'sucursal', 'telefono', 'nombre-admin', 'password', 'pin'];
const faltan = requeridos.filter((k) => !args[k]);
if (faltan.length) {
  console.error('Faltan datos: ' + faltan.map((k) => '--' + k).join(', ') + '  (opcional: --dominios=app.cliente.com,otro.com)');
  process.exit(1);
}

const entrada = {
  slug: args.slug,
  nombre: args.nombre,
  tipoNegocio: args.tipo,
  zonaHoraria: args.zona,
  moneda: args.moneda,
  dominios: (args.dominios || '').split(',').map((d) => d.trim()).filter(Boolean),
  sucursal: args.sucursal,
  admin: { nombre: args['nombre-admin'], telefono: args.telefono, password: args.password, pin: args.pin },
};

const validado = crearEmpresaBody.safeParse(entrada);
if (!validado.success) {
  validado.error.issues.forEach((i) => console.error(` - ${i.path.join('.')}: ${i.message}`));
  await pool.end();
  process.exit(1);
}

try {
  const resultado = await altaEmpresa(validado.data);
  console.log('Empresa creada:', resultado);
} catch (err) {
  console.error('No se pudo crear la empresa:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}