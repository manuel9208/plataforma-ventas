import { formatearFechaLarga } from '../../utils/formato.js';

const textoDe = (m, verMotivo) => {
  if (m.tipo === 'ganado') return m.origen === 'entrega' ? 'Puntos por servicio entregado' : 'Puntos por compra';
  if (m.tipo === 'reversa') return 'Se restaron por una devolución';
  if (m.tipo === 'canje') return 'Usaste puntos en una compra';
  // Los puntos que vuelven por cancelar o devolver algo pagado con puntos
  if (m.tipo === 'ajuste' && m.origen === 'canje') return 'Te devolvimos puntos';
  return verMotivo && m.motivo ? `Ajuste de la tienda: ${m.motivo}` : 'Ajuste de la tienda';
};

// verMotivo: solo el personal ve el motivo de un ajuste; el cliente no
export default function ListaMovimientosPuntos({ movimientos, verMotivo = false }) {
  if (!movimientos.length) return <p className="text-sm text-neutral-500">Aún no hay movimientos.</p>;

  return (
    <ul className="divide-y divide-[var(--c-borde)]">
      {movimientos.map((m) => (
        <li key={m.id} className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{textoDe(m, verMotivo)}</p>
            <p className="text-xs text-neutral-400">
              {formatearFechaLarga(m.fecha)}
              {m.folio ? ` · ${m.folio}` : ''}
              {m.venceEn && m.puntos > 0 ? ` · vence el ${formatearFechaLarga(m.venceEn)}` : ''}
            </p>
          </div>
          <span className={`shrink-0 font-semibold ${m.puntos > 0 ? 'text-emerald-700' : m.puntos < 0 ? 'text-red-700' : 'text-neutral-400'}`}>
            {m.puntos > 0 ? `+${m.puntos}` : m.puntos < 0 ? `−${Math.abs(m.puntos)}` : '0'}
          </span>
        </li>
      ))}
    </ul>
  );
}