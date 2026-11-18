import { useMemo, useState } from 'react';
import { normalizarPagosNota, sugerenciasEfectivo } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const FORMAS = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'mixto', nombre: 'Mixto' },
];

let contador = 0;
const filaNueva = (forma = 'efectivo') => ({ _k: `s${++contador}`, forma, monto: '', recibido: '', referencia: '' });

export default function ModalCobrarSaldo({ saldo, enviando, error, onConfirmar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  const [modo, setModo] = useState('efectivo');
  const [parte, setParte] = useState(''); // vacío = todo el saldo
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');
  const [filas, setFilas] = useState(() => [filaNueva('efectivo'), filaNueva('tarjeta')]);

  const monto = parte === '' ? saldo : Number(parte);

  const { pagos, cambio, problema } = useMemo(() => {
    let lista = [];
    if (modo === 'mixto') {
      lista = filas
        .filter((f) => f.monto !== '')
        .map((f) => ({
          forma: f.forma,
          monto: Number(f.monto),
          ...(f.forma === 'efectivo' && f.recibido !== '' ? { recibido: Number(f.recibido) } : {}),
          ...(f.referencia.trim() ? { referencia: f.referencia.trim() } : {}),
        }));
    } else if (monto > 0) {
      lista = [
        modo === 'efectivo'
          ? { forma: 'efectivo', monto, recibido: recibido === '' ? monto : Number(recibido) }
          : { forma: modo, monto, ...(referencia.trim() ? { referencia: referencia.trim() } : {}) },
      ];
    }
    if (!lista.length) return { pagos: null, cambio: 0, problema: '' };
    if (lista.some((p) => !(p.monto > 0))) return { pagos: null, cambio: 0, problema: 'Revisa los montos' };
    const suma = lista.reduce((s, p) => s + p.monto, 0);
    if (suma - saldo > 0.005) return { pagos: null, cambio: 0, problema: `El cobro no puede pasar del saldo (${dinero(saldo)})` };
    try {
      const normales = normalizarPagosNota(saldo, lista, 0.01);
      return { pagos: normales, cambio: normales.reduce((s, p) => s + p.cambio, 0), problema: '' };
    } catch (e) {
      return { pagos: null, cambio: 0, problema: e.message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, filas, monto, recibido, referencia, saldo]);

  const cambiarFila = (k, cambios) => setFilas((fs) => fs.map((f) => (f._k === k ? { ...f, ...cambios } : f)));
  const totalCobro = pagos ? pagos.reduce((s, p) => s + p.monto, 0) : 0;

  const cobrar = () => {
    if (!pagos || enviando) return;
    onConfirmar({
      pagos: pagos.map((p) => ({
        forma: p.forma,
        monto: p.monto,
        recibido: p.recibido,
        ...(p.referencia ? { referencia: p.referencia } : {}),
      })),
    });
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Cobrar saldo"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" disabled={!pagos} cargando={enviando} onClick={cobrar}>
            {pagos ? `Cobrar ${dinero(totalCobro)}` : 'Cobrar'}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-sm text-neutral-500">Saldo pendiente</p>
          <p className="text-4xl font-semibold tracking-tight">{dinero(saldo)}</p>
        </div>

        <div className="grid grid-cols-4 gap-2" role="tablist">
          {FORMAS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModo(f.id)}
              className={`min-h-11 rounded-xl text-xs sm:text-sm font-semibold transition ${
                modo === f.id
                  ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                  : 'bg-white border border-[var(--c-borde)] text-neutral-600'
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        {modo === 'efectivo' && monto > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sugerenciasEfectivo(monto).map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRecibido(String(v))}
                  className="min-h-10 px-4 rounded-xl border border-[var(--c-borde)] bg-white text-sm font-medium hover:border-[var(--c-acento)]"
                >
                  {i === 0 ? 'Exacto' : dinero(v)}
                </button>
              ))}
            </div>
            <Campo
              etiqueta="Efectivo recibido"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={recibido}
              placeholder={String(monto)}
              onChange={(e) => setRecibido(e.target.value)}
            />
            {cambio > 0 && <p className="text-center rounded-xl bg-emerald-50 text-emerald-800 py-3 font-semibold">Cambio: {dinero(cambio)}</p>}
          </div>
        )}

        {(modo === 'tarjeta' || modo === 'transferencia') && monto > 0 && (
          <Campo
            etiqueta={modo === 'transferencia' ? 'Referencia *' : 'Referencia (opcional)'}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            ayuda={modo === 'transferencia' ? 'Número de operación o clave de rastreo' : 'Últimos dígitos o folio del voucher'}
          />
        )}

        {modo === 'mixto' && (
          <div className="space-y-3">
            {filas.map((f) => (
              <div key={f._k} className="rounded-2xl border border-[var(--c-borde)] p-3 space-y-3">
                <div className="flex gap-2">
                  <select
                    value={f.forma}
                    onChange={(e) => cambiarFila(f._k, { forma: e.target.value })}
                    className="flex-1 min-h-11 px-3 rounded-xl bg-white border border-[var(--c-borde)] text-sm outline-none"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                  {filas.length > 2 && (
                    <button
                      type="button"
                      aria-label="Quitar pago"
                      onClick={() => setFilas((fs) => fs.filter((x) => x._k !== f._k))}
                      className="size-11 shrink-0 rounded-xl bg-[#f3efe6] text-neutral-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    etiqueta="Monto"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={f.monto}
                    onChange={(e) => cambiarFila(f._k, { monto: e.target.value })}
                  />
                  {f.forma === 'efectivo' ? (
                    <Campo
                      etiqueta="Recibido"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={f.recibido}
                      onChange={(e) => cambiarFila(f._k, { recibido: e.target.value })}
                    />
                  ) : (
                    <Campo
                      etiqueta={f.forma === 'transferencia' ? 'Referencia *' : 'Referencia'}
                      value={f.referencia}
                      onChange={(e) => cambiarFila(f._k, { referencia: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
            {filas.length < 6 && (
              <Boton compacto variante="secundario" onClick={() => setFilas((fs) => [...fs, filaNueva('efectivo')])}>
                + Agregar otro pago
              </Boton>
            )}
          </div>
        )}

        {modo !== 'mixto' && (
          <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3">
            <summary className="cursor-pointer font-medium min-h-8 flex items-center">Cobrar solo una parte</summary>
            <div className="mt-3">
              <Campo
                etiqueta="¿Cuánto cobra ahora?"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={saldo}
                value={parte}
                placeholder={String(saldo)}
                onChange={(e) => setParte(e.target.value)}
                ayuda="Si lo dejas vacío se cobra todo el saldo."
              />
            </div>
          </details>
        )}

        {pagos && (
          <p className="text-sm text-center text-neutral-500">
            {saldo - totalCobro > 0.005 ? `Después de este cobro quedará un saldo de ${dinero(saldo - totalCobro)}` : 'Con este cobro la nota queda pagada'}
          </p>
        )}
        {problema && <p className="text-sm text-red-600">{problema}</p>}
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}