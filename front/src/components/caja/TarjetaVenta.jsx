import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';
import EtiquetaVenta from './EtiquetaVenta.jsx';

export default function TarjetaVenta({ venta, verTodas, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <article className="rounded-3xl bg-white border border-[var(--c-borde)] shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] overflow-hidden">
      <button type="button" onClick={() => onAbrir(venta)} className="w-full text-left p-5 transition hover:bg-[#fbfaf6]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">{venta.folio}</p>
            <p className="text-sm text-neutral-600 truncate">{venta.cliente ? venta.cliente.nombre : 'Sin cliente'}</p>
            <p className="text-xs text-neutral-400">
              {venta.articulos} {venta.articulos === 1 ? 'producto' : 'productos'}
              {verTodas ? ` · ${venta.caja} · ${venta.cajero}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold">{dinero(venta.total)}</p>
            {venta.devuelto > 0 && <p className="text-xs font-semibold text-red-700">Devuelto {dinero(venta.devuelto)}</p>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-400">{formatearFechaHora(venta.creadaEn, venta.zonaHoraria)}</p>
          <EtiquetaVenta estado={venta.estado} />
        </div>
      </button>
    </article>
  );
}