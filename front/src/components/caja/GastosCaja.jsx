import { useState } from 'react';
import { ETIQUETA_CATEGORIA } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearHora, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import ModalGasto from './ModalGasto.jsx';
import ModalRetiro from './ModalRetiro.jsx';
import ModalAnularMovimiento from './ModalAnularMovimiento.jsx';

// Gastos y retiros de efectivo del turno actual
export default function GastosCaja({ mov }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const [gasto, setGasto] = useState(false);
  const [retiro, setRetiro] = useState(false);
  const [anulando, setAnulando] = useState(null);

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 mb-4 max-w-xl">
        <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
          <p className="text-sm text-neutral-500">Gastos del turno</p>
          <p className="text-2xl font-semibold tracking-tight">{dinero(mov.totales.gastos)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
          <p className="text-sm text-neutral-500">Retiros del turno</p>
          <p className="text-2xl font-semibold tracking-tight">{dinero(mov.totales.retiros)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <Boton onClick={() => setGasto(true)}>Registrar gasto</Boton>
        <Boton variante="secundario" onClick={() => setRetiro(true)}>
          Retirar efectivo
        </Boton>
      </div>

      {mov.error && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={mov.error} />
        </div>
      )}

      {mov.movimientos.length === 0 ? (
        <p className="text-neutral-500">Aún no hay gastos ni retiros en este turno.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mov.movimientos.map((m) => (
            <li key={m.id} className={`rounded-2xl bg-white border border-[var(--c-borde)] p-4 ${m.anulado ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`font-medium ${m.anulado ? 'line-through' : ''}`}>
                    {m.tipo === 'retiro' ? 'Retiro de efectivo' : m.concepto}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {m.tipo === 'retiro' ? `Recibió ${m.recibe}` : ETIQUETA_CATEGORIA[m.categoria]}
                    {m.referencia ? ` · ${m.referencia}` : ''}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {m.hizo} · {formatearHora(m.creadoEn, mov.zonaHoraria)}
                  </p>
                </div>
                <p className={`font-semibold shrink-0 ${m.anulado ? 'line-through' : ''}`}>{dinero(m.monto)}</p>
              </div>
              {m.anulado ? (
                <p className="mt-3 text-xs text-neutral-500">
                  Anulado por {m.anulo}: {m.anuladoMotivo}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnulando(m)}
                  className="mt-3 min-h-9 px-3 rounded-lg border border-[var(--c-borde)] text-sm text-neutral-600 hover:text-red-700"
                >
                  Anular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {gasto && <ModalGasto onCrear={mov.crear} onCerrar={() => setGasto(false)} />}
      {retiro && <ModalRetiro onCrear={mov.crear} onCerrar={() => setRetiro(false)} />}
      {anulando && <ModalAnularMovimiento movimiento={anulando} onAnular={mov.anular} onCerrar={() => setAnulando(null)} />}
    </section>
  );
}