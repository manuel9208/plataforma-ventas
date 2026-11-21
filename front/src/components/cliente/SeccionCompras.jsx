import * as svc from '../../services/miCuenta.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';
import MensajeError from '../shared/MensajeError.jsx';
import { useLista } from './useLista.js';

export default function SeccionCompras() {
  const { empresa } = useAuth();
  const l = useLista(svc.compras);

  if (l.cargando) return <p className="text-center text-neutral-400 py-10">Cargando…</p>;
  if (l.error) return <MensajeError error={l.error} />;
  if (!l.datos.length) return <p className="text-center text-neutral-500 py-10">Aún no tienes compras registradas.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {l.datos.map((c) => (
        <li key={c.folio} className="rounded-2xl bg-white border border-[var(--c-borde)] p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{c.folio}</p>
            <p className="text-xs text-neutral-500">{c.tipo === 'nota' ? 'Nota de servicio' : 'Compra en mostrador'}</p>
            <p className="text-xs text-neutral-400">
              {c.sucursal} · {formatearFechaHora(c.creadaEn, c.zonaHoraria)}
            </p>
          </div>
          <p className="font-semibold shrink-0">{formatearMoneda(c.total, empresa.moneda)}</p>
        </li>
      ))}
    </ul>
  );
}