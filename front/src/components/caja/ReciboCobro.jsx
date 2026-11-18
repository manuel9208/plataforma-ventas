import { useAuth } from '../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';

export default function ReciboCobro({ recibo, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const quien = [recibo.caja, recibo.cobro].filter(Boolean).join(' · ');

  return (
    <Modal
      abierto
      titulo="Cobro registrado"
      onCerrar={onCerrar}
      pie={
        <Boton className="flex-1" onClick={onCerrar}>
          Listo
        </Boton>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Recibo de pago</p>
          <p className="text-xl font-semibold tracking-tight mt-1">{recibo.folio}</p>
          {recibo.cliente && <p className="text-neutral-600">{recibo.cliente.nombre}</p>}
          <p className="text-xs text-neutral-400">
            {formatearFechaHora(recibo.cobradoEn, recibo.zonaHoraria)}
            {quien ? ` · ${quien}` : ''}
          </p>
        </div>

        <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-1">
          {recibo.pagos.map((p, i) => (
            <div key={i} className="flex justify-between text-neutral-600">
              <span>
                {ETIQUETA_FORMA[p.forma]}
                {p.referencia ? ` · ${p.referencia}` : ''}
              </span>
              <span>{dinero(p.monto)}</span>
            </div>
          ))}
          <div className="flex justify-between items-baseline pt-2 mt-2 border-t border-[var(--c-borde)]">
            <span className="font-medium">Cobrado</span>
            <span className="text-xl font-semibold">{dinero(recibo.monto)}</span>
          </div>
          {recibo.cambio > 0 && (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Cambio</span>
              <span>{dinero(recibo.cambio)}</span>
            </div>
          )}
        </div>

        <div className="space-y-1 text-neutral-600">
          <div className="flex justify-between">
            <span>Total de la nota</span>
            <span>{dinero(recibo.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pagado</span>
            <span>{dinero(recibo.pagado)}</span>
          </div>
          <div className="flex justify-between font-semibold text-neutral-900">
            <span>Saldo</span>
            <span>{dinero(recibo.saldo)}</span>
          </div>
        </div>

        {recibo.saldo === 0 && <p className="text-center rounded-xl bg-emerald-50 text-emerald-800 py-2 font-semibold">Nota pagada completa</p>}
        {recibo.repetido && <p className="text-center text-xs text-neutral-400">Este cobro ya estaba registrado; no se cobró de nuevo.</p>}
      </div>
    </Modal>
  );
}