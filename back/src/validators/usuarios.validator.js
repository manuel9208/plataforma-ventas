import { z } from 'zod';
import { telefono, correo, password, pin, fecha } from './comunes.validator.js';

const idNumero = z.number().int().positive();
const clavePermiso = z.string().regex(/^[a-z0-9_.]{1,60}$/, 'Permiso inválido'); // "*" no cabe aquí
const permisos = z.record(clavePermiso, z.boolean());
const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80);
const direccion = z.string().trim().min(3).max(200);
const nombreContacto = z.string().trim().min(2).max(80);

// Datos laborales (México)
const rfc = z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC inválido');
const nss = z.string().trim().regex(/^\d{11}$/, 'Debe tener 11 dígitos');
const curp = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/, 'CURP inválida');

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listarQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limite: z.coerce.number().int().min(1).max(50).default(20),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const crearBody = z
  .object({
    nombre,
    telefono,
    password,
    pin,
    rolId: idNumero,
    sucursalIds: z.array(idNumero).min(1, 'Elige al menos una sucursal').max(50),
    permisos: permisos.default({}),
    fechaIngreso: fecha.optional(),
    correo: correo.optional(),
    direccion: direccion.optional(),
    fechaNacimiento: fecha.optional(),
    contactoEmergenciaNombre: nombreContacto.optional(),
    contactoEmergenciaTelefono: telefono.optional(),
    rfc: rfc.optional(),
    nss: nss.optional(),
    curp: curp.optional(),
  })
  .strict();

export const actualizarBody = z
  .object({
    nombre: nombre.optional(),
    telefono: telefono.optional(),
    password: password.optional(),
    pin: pin.optional(),
    rolId: idNumero.optional(),
    sucursalIds: z.array(idNumero).min(1, 'Elige al menos una sucursal').max(50).optional(),
    permisos: permisos.optional(),
    activo: z.boolean().optional(),
    fechaIngreso: fecha.optional(),
    correo: correo.nullable().optional(),
    direccion: direccion.nullable().optional(),
    fechaNacimiento: fecha.nullable().optional(),
    contactoEmergenciaNombre: nombreContacto.nullable().optional(),
    contactoEmergenciaTelefono: telefono.nullable().optional(),
    rfc: rfc.optional(),
    nss: nss.optional(),
    curp: curp.optional(),
  })
  .strict();