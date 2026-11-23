import { useAuth } from '../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';

// Comprobante de una cancelación o de un reembolso. Nunca muestra PIN.
export default function ComprobanteAjuste({ comprobante: c, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const esCancelacion = c.tipo === 'cancelacion' || c.tipo === 'devolucion';
  const esDevolucion = c.tipo === 'devolucion';

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">
          {esDevolucion ? 'Devolución' : esCancelacion ? 'Cancelación' : 'Reembolso'}
        </p>
        <h2 className="text-center text-xl font-semibold tracking-tight mt-1">{c.folio}</h2>
        <p className="text-center text-sm text-neutral-500">
          {empresa.nombre} · {c.sucursal}
        </p>
        <p className="text-center text-xs text-neutral-400">
          {[formatearFechaHora(c.creadoEn, c.zonaHoraria), c.caja, c.hizo].filter(Boolean).join(' · ')}
        </p>
        {c.cliente && (
          <p className="text-center text-sm text-neutral-600 mt-2">
            {c.cliente.nombre} · {c.cliente.telefono}
          </p>
        )}

        {c.cancelados.length > 0 && (
          <ul className="mt-5 divide-y divide-[var(--c-borde)] text-sm">
            {c.cancelados.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {p.cantidad ? `${p.cantidad} × ` : ''}
                  {p.nombre}
                </span>
                <span className="font-medium shrink-0">{dinero(p.total)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm">
          {esCancelacion && (
            <div className="flex justify-between text-neutral-600">
              <span>{esDevolucion ? 'Valor de lo devuelto' : 'Cancelado'}</span>
              <span>{dinero(c.valorCancelado)}</span>
            </div>
          )}
          {c.reembolso && (
            <div className="flex justify-between font-semibold text-neutral-900">
              <span>
                Devuelto · {ETIQUETA_FORMA[c.reembolso.forma]}
                {c.reembolso.referencia ? ` · ${c.reembolso.referencia}` : ''}
              </span>
              <span>{dinero(c.reembolso.monto)}</span>
            </div>
          )}
          {esCancelacion && c.retenido > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Retenido por el trabajo hecho</span>
              <span>{dinero(c.retenido)}</span>
            </div>
          )}
          {esCancelacion && !c.reembolso && <p className="text-neutral-400">No se devolvió dinero.</p>}
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm text-neutral-600">
          <div className="flex justify-between gap-3">
            <span>Motivo</span>
            <span className="text-right">{c.motivo}</span>
          </div>
          {c.autorizo && (
            <div className="flex justify-between gap-3">
              <span>Autorizó</span>
              <span className="text-right">{c.autorizo}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t border-[var(--c-borde)]">
            <span>Ahora la nota vale</span>
            <span>{dinero(c.nota.total)}</span>
          </div>
          <div className="flex justify-between font-semibold text-neutral-900">
            <span>Saldo</span>
            <span>{dinero(c.nota.saldo)}</span>
          </div>
        </div>
      </div>

      {c.repetido && <p className="text-center text-xs text-neutral-400">Esta operación ya estaba registrada; no se hizo de nuevo.</p>}
      <Boton className="w-full" onClick={onCerrar}>
        Listo
      </Boton>
      <p className="text-center text-xs text-neutral-400">La impresión del comprobante llega en una etapa posterior.</p>
    </div>
  );
}