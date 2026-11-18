import { z } from 'zod';
import { zonaValida } from '../utils/zonasHorarias.js';

export const paramsEmpresa = z.object({ id: z.coerce.number().int().positive('Empresa inválida') });

export const paramsSucursal = z.object({
  id: z.coerce.number().int().positive('Empresa inválida'),
  sid: z.coerce.number().int().positive('Sucursal inválida'),
});

const nombre = z.string().trim().min(2, 'Escribe el nombre').max(80);
const direccion = z.string().trim().max(200);
const zona = z.string().trim().refine(zonaValida, 'Zona horaria inválida');

export const crearSucursalBody = z.object({ nombre, direccion: direccion.optional(), zonaHoraria: zona.optional() }).strict();

export const editarSucursalBody = z
  .object({
    nombre: nombre.optional(),
    direccion: direccion.optional(),
    // null = usa la zona de la empresa
    zonaHoraria: zona.nullable().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios que guardar' });

export const bajaBody = z.object({ motivo: z.string().trim().min(3, 'Escribe el motivo').max(200) }).strict();