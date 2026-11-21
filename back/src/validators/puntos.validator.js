import { z } from 'zod';

// Ajuste a mano: + regala o corrige a favor, − quita. El id lo genera la pantalla para que un reintento no lo repita.
export const ajustePuntosBody = z
  .object({
    id: z.string().uuid('Operación inválida'),
    puntos: z
      .number()
      .int('Escribe puntos enteros')
      .refine((n) => n !== 0, 'Escribe cuántos puntos')
      .refine((n) => Math.abs(n) <= 100000, 'Son demasiados puntos'),
    motivo: z.string().trim().min(3, 'Escribe el motivo').max(200),
  })
  .strict();