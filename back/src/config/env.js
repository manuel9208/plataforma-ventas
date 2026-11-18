import 'dotenv/config';

// ➕ Para agregar una variable global: una línea aquí y una en .env (y en .env.example)
const DEFINICION = {
  DATABASE_URL: { requerida: true },
  SESSION_SECRET: {
    requerida: true,
    validar: (v) => v.length >= 32 || 'debe tener 32 caracteres o más',
  },
  MASTER_KEY: {
    requerida: true,
    validar: (v) => /^[0-9a-fA-F]{64}$/.test(v) || 'debe ser de 64 caracteres hexadecimales',
  },
  PORT: { defecto: '4000', tipo: 'numero' },
  CORS_ORIGINS: { defecto: '', tipo: 'lista' },
};

const errores = [];
const valores = {};

for (const [nombre, regla] of Object.entries(DEFINICION)) {
  let v = (process.env[nombre] ?? '').trim();
  if (!v && regla.defecto !== undefined) v = regla.defecto;

  if (!v && regla.requerida) {
    errores.push(`Falta ${nombre}`);
    continue;
  }
  if (v && regla.validar) {
    const r = regla.validar(v);
    if (r !== true) {
      errores.push(`${nombre} ${r}`);
      continue;
    }
  }
  if (regla.tipo === 'numero') {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) {
      errores.push(`${nombre} debe ser un número entero`);
      continue;
    }
    valores[nombre] = n;
  } else if (regla.tipo === 'lista') {
    valores[nombre] = v.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    valores[nombre] = v;
  }
}

if (errores.length) {
  console.error('Configuración inválida en .env:');
  errores.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}

export const env = Object.freeze(valores);