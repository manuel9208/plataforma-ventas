import { estadoPerfil } from '@plataforma/calculos';

const perfilDe = (v) => estadoPerfil({ correo: v.correo, cumpleMes: v.cumpleanos?.mes, cumpleDia: v.cumpleanos?.dia, tienePin: v.tienePin });

// Lo que la Caja necesita saber de un cliente (viene de la API de clientes)
export const vistaCliente = (c) => ({
  id: c.id,
  nombre: c.nombre,
  telefono: c.telefono,
  correo: c.correo ?? null,
  cumpleanos: c.cumpleanos ?? null,
  tienePin: Boolean(c.tienePin),
  perfil: c.perfil ?? perfilDe({ correo: c.correo, cumpleanos: c.cumpleanos, tienePin: c.tienePin }),
});

// Cambia datos de la vista y recalcula el perfil con la misma fórmula del servidor
export function actualizarVista(v, cambios) {
  const n = { ...v, ...cambios };
  return { ...n, perfil: perfilDe(n) };
}

export const conPin = (v) => actualizarVista(v, { tienePin: true });