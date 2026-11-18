import { aCentavos, aMonto } from './redondeo.js';

export const METODOS_ENTREGA = ['pin', 'autorizacion', 'sin_pin'];

export const ETIQUETA_METODO = {
  pin: 'Con el PIN del cliente',
  autorizacion: 'Autorizada por un encargado',
  sin_pin: 'Sin PIN (la sucursal no lo pide)',
};

// Si la nota debe dinero no se entrega. Devuelve el aviso, o null si ya está pagada.
export function mensajeSaldoPendiente(saldo = 0) {
  const c = aCentavos(saldo);
  return c > 0 ? `Esta nota debe $${aMonto(c).toFixed(2)}. Cobra el saldo antes de entregar.` : null;
}

// ¿Se pueden entregar estos artículos? articulos: [{ id, estado }]. elegidos: ids que se quieren entregar.
export function evaluarEntrega({ saldo = 0, articulos = [], elegidos = [] }) {
  if (!elegidos.length) return { ok: false, motivo: 'Elige al menos un artículo' };
  if (new Set(elegidos).size !== elegidos.length) return { ok: false, motivo: 'Hay artículos repetidos' };
  const aviso = mensajeSaldoPendiente(saldo);
  if (aviso) return { ok: false, motivo: aviso };
  const porId = new Map(articulos.map((a) => [a.id, a]));
  for (const id of elegidos) {
    const a = porId.get(id);
    if (!a) return { ok: false, motivo: 'Hay un artículo que no pertenece a esta nota' };
    if (a.estado !== 'listo') return { ok: false, motivo: 'Solo se entregan artículos que estén Listos' };
  }
  return { ok: true, motivo: null };
}