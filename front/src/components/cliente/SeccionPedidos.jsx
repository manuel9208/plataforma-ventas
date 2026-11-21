import * as svc from '../../services/miCuenta.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import MensajeError from '../shared/MensajeError.jsx';
import EtiquetaEstado from '../caja/EtiquetaEstado.jsx';
import { useLista } from './useLista.js';

const ESTADO_NOTA = {
  lista: { texto: 'Lista para recoger', clase: 'bg-emerald-50 text-emerald-700' },
  entregada: { texto: 'Entregada', clase: 'bg-neutral-100 text-neutral-600' },
  cancelada: { texto: 'Cancelada', clase: 'bg-red-50 text-red-700' },
};

const datosDe = (s) => Object.values(s.articulo ?? {}).join(' · ');

export default function SeccionPedidos() {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const l = useLista(svc.pedidos);

  if (l.cargando) return <p className="text-center text-neutral-400 py-10">Cargando…</p>;
  if (l.error) return <MensajeError error={l.error} />;
  if (!l.datos.length) {
    return <p className="text-center text-neutral-500 py-10">Aún no tienes pedidos. Cuando dejes tus artículos, aquí verás cómo van.</p>;
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {l.datos.map((p) => {
        const marca = ESTADO_NOTA[p.estado];
        return (
          <li key={p.folio} className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{p.folio}</p>
                <p className="text-xs text-neutral-500">
                  {p.sucursal} · {formatearFechaHora(p.creadaEn, p.zonaHoraria)}
                </p>
              </div>
              {marca && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${marca.clase}`}>{marca.texto}</span>}
            </div>

            <ul className="mt-4 space-y-2">
              {p.servicios.map((s, i) => {
                const datos = datosDe(s);
                const mostrarDatos = datos && datos !== (i > 0 ? datosDe(p.servicios[i - 1]) : null);
                const pendiente = s.estado !== 'entregado' && s.estado !== 'cancelado';
                return (
                  <li key={i} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-3 text-sm">
                    {mostrarDatos && <p className="font-semibold mb-1">{datos}</p>}
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium min-w-0">{s.nombre}</p>
                      <EtiquetaEstado estado={s.estado} />
                    </div>
                    {pendiente && s.fechaPrometida && (
                      <p className="text-xs text-[var(--c-primario)] font-medium mt-1">Entrega: {formatearFechaLarga(s.fechaPrometida)}</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Total</span>
                <span>{dinero(p.total)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Pagado</span>
                <span>{dinero(p.pagado)}</span>
              </div>
              <div className={`flex justify-between font-semibold ${p.saldo > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                <span>{p.saldo > 0 ? 'Por pagar' : 'Pagada'}</span>
                <span>{dinero(p.saldo)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}