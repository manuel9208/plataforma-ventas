import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';

export default function TotalesPorSucursal({ porSucursal }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <section>
      <h3 className="font-semibold tracking-tight mb-3">Por sucursal</h3>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {porSucursal.map((s) => (
          <li key={s.sucursalId} className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold truncate">{s.sucursal}</p>
              <p className="text-xs text-neutral-400 shrink-0">
                {s.notas} {s.notas === 1 ? 'nota o venta' : 'notas y ventas'}
              </p>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{dinero(s.vendido)}</p>
            <p className="text-xs text-neutral-400">Vendido</p>
            <div className="mt-3 space-y-1 text-sm text-neutral-600">
              <div className="flex justify-between">
                <span>Abonado</span>
                <span>{dinero(s.abonado)}</span>
              </div>
              <div className={`flex justify-between ${s.pendiente > 0 ? 'text-amber-700' : ''}`}>
                <span>Pendiente</span>
                <span>{dinero(s.pendiente)}</span>
              </div>
              <div className="flex justify-between font-medium text-neutral-900">
                <span>Dinero que entró</span>
                <span>{dinero(s.entro.total)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}