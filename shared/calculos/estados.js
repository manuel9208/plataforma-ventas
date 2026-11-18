// Estado de cada artículo como se ve en pantalla. En la base de datos se guarda:
// recibido | en_proceso | listo | entregado | cancelado
export const ETIQUETA_ESTADO = {
  recibido: 'En espera',
  en_proceso: 'En espera',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const etiquetaEstado = (estado) => ETIQUETA_ESTADO[estado] ?? estado;

// Cambios permitidos a mano. Entregado y cancelado tienen su propio flujo (PIN y reembolso).
export const ESTADOS_MANUALES = ['listo', 'en_espera'];

// Regresar un artículo de "listo" a "en espera" necesita permiso y motivo
export const requiereGestion = (estadoActual, estadoNuevo) => estadoActual === 'listo' && estadoNuevo === 'en_espera';

// Pestañas de la lista de notas: ÚNICA lista (la usan el validador, el repositorio y la pantalla)
export const PESTANAS_NOTAS = ['cobrar', 'espera', 'entregar', 'entregadas', 'canceladas'];
// Estas dos solo las ven quienes tienen el permiso notas.gestionar
export const PESTANAS_DE_GESTION = ['entregadas', 'canceladas'];

// En qué pestañas cae una nota, según su saldo y los contadores de sus artículos
export function pestanasDeNota({ saldo = 0, enEspera = 0, listos = 0, entregados = 0, cancelados = 0, articulos = 0 }) {
  const p = [];
  if (saldo > 0 && cancelados < articulos) p.push('cobrar');
  if (enEspera > 0) p.push('espera');
  if (listos > 0) p.push('entregar');
  if (enEspera + listos === 0 && entregados > 0) p.push('entregadas');
  if (articulos > 0 && cancelados === articulos) p.push('canceladas');
  return p;
}