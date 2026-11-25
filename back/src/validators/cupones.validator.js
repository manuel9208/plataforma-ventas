import { z } from 'zod';
import { fecha } from './comunes.validator.js';

const idNumero = z.number().int().positive();

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const listaQuery = z.object({
  buscar: z.string().trim().max(60).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(20),
  pagina: z.coerce.number().int().min(1).default(1),
});

// Aquí solo la forma de los datos. Las reglas viven en shared/calculos/cupones.js
const campos = {
  nombre: z.string().trim().min(2, 'Escribe el nombre').max(60),
  modo: z.enum(['porcentaje', 'monto']),
  valor: z.number().positive().max(99999.99),
  desde: fecha.nullish(),
  hasta: fecha.nullish(),
  vecesPorCliente: z.number().int().min(1).max(100).default(1),
  maxClientes: z.number().int().min(1).max(100000).nullish(),
  sucursalIds: z.array(idNumero).max(50).default([]),
};

export const cuponBody = z
  .object({ ...campos, codigo: z.string().trim().max(30).nullish(), clienteId: z.string().uuid().nullish() })
  .strict();

// El código y el cliente no se cambian al editar
export const cuponEdicionBody = z.object(campos).strict();

export const encendidoBody = z.object({ encendido: z.boolean() }).strict();
export const bajaBody = z.object({ motivo: z.string().trim().min(3, 'Escribe el motivo').max(200) }).strict();

// Caja: revisar un código
export const cuponQuery = z.object({
  codigo: z.string().trim().min(3).max(30),
  clienteId: z.string().uuid('Cliente inválido'),
});