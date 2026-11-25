import * as svc from '../../services/miCuenta.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import MensajeError from '../shared/MensajeError.jsx';
import { useLista } from './useLista.js';

const ETIQUETA = { agotado: 'Ya lo usaste', programado: 'Aún no inicia' };

export default function SeccionCupones() {
  const { empresa } = useAuth();
  const l = useLista(svc.cupones);

  if (l.cargando) return <p className="text-center text-neutral-400 py-10">Cargando…</p>;
  if (l.error) return <MensajeError error={l.error} />;
  if (!l.datos.length) return <p className="text-center text-neutral-500 py-10">Por ahora no tienes cupones.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {l.datos.map((c) => {
        const activo = c.estado === 'disponible';
        return (
          <li key={c.codigo} className={`rounded-2xl bg-white border border-[var(--c-borde)] p-4 ${activo ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.nombre}</p>
                <p className="text-xs text-neutral-500">
                  {c.sucursales.length ? c.sucursales.join(', ') : 'En todas las sucursales'}
                </p>
              </div>
              <p className="text-2xl font-semibold tracking-tight shrink-0 text-[var(--c-primario)]">
                {c.modo === 'porcentaje' ? `${c.valor}%` : formatearMoneda(c.valor, empresa.moneda)}
              </p>
            </div>

            <div className="mt-3 rounded-xl border-2 border-dashed border-[var(--c-acento)] bg-amber-50/50 py-2 text-center">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Código</p>
              <p className="text-lg font-semibold tracking-[0.2em]">{c.codigo}</p>
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              {c.hasta ? `Vence el ${formatearFechaLarga(c.hasta)}` : 'Sin fecha de vencimiento'}
              {c.desde && c.estado === 'programado' ? ` · Inicia el ${formatearFechaLarga(c.desde)}` : ''}
            </p>
            <p className={`text-xs font-medium ${activo ? 'text-emerald-700' : 'text-amber-700'}`}>
              {activo ? `Te quedan ${c.restantes} ${c.restantes === 1 ? 'uso' : 'usos'}` : ETIQUETA[c.estado]}
            </p>
          </li>
        );
      })}
    </ul>
  );
}