import { useMemo, useState } from 'react';
import { abonoSugerido, normalizarPagos, normalizarPagosNota, pagoMinimoNota, resumenPagos, sugerenciasEfectivo } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import BuscadorCliente from './BuscadorCliente.jsx';

const FORMAS = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'mixto', nombre: 'Mixto' },
];

let contador = 0;
const filaNueva = (forma = 'efectivo', monto = '') => ({ _k: `p${++contador}`, forma, monto, recibido: '', referencia: '' });
const redondear = (n) => Number(Number(n).toFixed(2));

// total: lo que cuesta todo. totalServicios: la parte que acepta abono. config: abono de la sucursal.
export default function ModalCobro({ total, totalProductos = 0, totalServicios = 0, config, clienteInicial = null, enviando, error, onConfirmar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const esNota = totalServicios > 0;

  const minimo = esNota
    ? pagoMinimoNota({ totalProductos, totalServicios, porcentaje: config.abonoPorcentaje, esMinimo: config.abonoEsMinimo })
    : total;
  const sugerido = esNota ? abonoSugerido({ totalProductos, totalServicios, porcentaje: config.abonoPorcentaje }) : total;

  const [modo, setModo] = useState('efectivo');
  const [aCobrar, setACobrar] = useState(String(sugerido)); // abono de la nota
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');
  const [filas, setFilas] = useState(() => [filaNueva('efectivo'), filaNueva('tarjeta')]);
  const [cliente, setCliente] = useState(clienteInicial?.envio ?? null);

  const montoNota = esNota ? Number(aCobrar || 0) : total;

  const { pagos, falta, cambio, problema } = useMemo(() => {
    let lista;
    if (modo === 'mixto') {
      lista = filas
        .filter((f) => f.monto !== '')
        .map((f) => ({
          forma: f.forma,
          monto: Number(f.monto),
          ...(f.forma === 'efectivo' && f.recibido !== '' ? { recibido: Number(f.recibido) } : {}),
          ...(f.referencia.trim() ? { referencia: f.referencia.trim() } : {}),
        }));
    } else if (modo === 'efectivo') {
      lista = montoNota > 0 ? [{ forma: 'efectivo', monto: montoNota, recibido: recibido === '' ? montoNota : Number(recibido) }] : [];
    } else {
      lista = montoNota > 0 ? [{ forma: modo, monto: montoNota, ...(referencia.trim() ? { referencia: referencia.trim() } : {}) }] : [];
    }

    // Abono de $0 en una nota: solo se permite si la empresa no exige abono mínimo
    if (esNota && lista.length === 0) {
      return minimo > 0
        ? { pagos: null, falta: minimo, cambio: 0, problema: `Debes cobrar al menos ${dinero(minimo)}` }
        : { pagos: [], falta: 0, cambio: 0, problema: '' };
    }

    const resumen = lista.length ? resumenPagos(esNota ? montoNota : total, lista) : { falta: total };
    try {
      const normales = esNota ? normalizarPagosNota(total, lista, minimo) : normalizarPagos(total, lista);
      return { pagos: normales, falta: 0, cambio: normales.reduce((s, p) => s + p.cambio, 0), problema: '' };
    } catch (e) {
      return { pagos: null, falta: resumen.falta, cambio: 0, problema: lista.length ? e.message : '' };
    }
  }, [modo, recibido, referencia, filas, montoNota, total, minimo, esNota]);

  const cambiarFila = (k, cambios) => setFilas((fs) => fs.map((f) => (f._k === k ? { ...f, ...cambios } : f)));

  // En una nota con servicios el cliente (teléfono y nombre) es obligatorio
  const faltaCliente = esNota && !cliente;
  const puedeCobrar = !!pagos && !enviando && !faltaCliente;

  const cobrar = () => {
    if (!puedeCobrar) return;
    onConfirmar({
      pagos: pagos.map((p) => ({ forma: p.forma, monto: p.monto, recibido: p.recibido, ...(p.referencia ? { referencia: p.referencia } : {}) })),
      cliente,
    });
  };

  const saldo = redondear(total - (pagos ? pagos.reduce((s, p) => s + p.monto, 0) : 0));
  const botonTexto = esNota ? (pagos?.length ? `Cobrar ${dinero(pagos.reduce((s, p) => s + p.monto, 0))}` : 'Guardar sin abono') : `Cobrar ${dinero(total)}`;

  const porcentajes = [25, 50, 75].map((p) => ({
    p,
    valor: redondear(totalProductos + (totalServicios * p) / 100),
  }));

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={esNota ? 'Cobrar la nota' : 'Cobrar'}
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" disabled={!puedeCobrar} cargando={enviando} onClick={cobrar}>
            {botonTexto}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-sm text-neutral-500">Total de la nota</p>
          <p className="text-4xl font-semibold tracking-tight">{dinero(total)}</p>
          {esNota && (
            <p className="text-sm text-neutral-500 mt-1">
              {config.abonoEsMinimo
                ? `Abono mínimo: ${dinero(minimo)} (${config.abonoPorcentaje}% de los servicios)`
                : `Sugerido: ${dinero(sugerido)} (${config.abonoPorcentaje}% de los servicios)`}
            </p>
          )}
        </div>

        {esNota && modo !== 'mixto' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {porcentajes.map(({ p, valor }) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setACobrar(String(valor))}
                  className="min-h-10 px-4 rounded-xl border border-[var(--c-borde)] bg-white text-sm font-medium hover:border-[var(--c-acento)]"
                >
                  {p}% · {dinero(valor)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setACobrar(String(total))}
                className="min-h-10 px-4 rounded-xl border border-[var(--c-borde)] bg-white text-sm font-medium hover:border-[var(--c-acento)]"
              >
                Total
              </button>
            </div>
            <Campo
              etiqueta="¿Cuánto abona el cliente?"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={total}
              value={aCobrar}
              onChange={(e) => setACobrar(e.target.value)}
              ayuda={saldo > 0 ? `Quedaría un saldo de ${dinero(saldo)}` : 'Queda pagada completa'}
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-2" role="tablist">
          {FORMAS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModo(f.id)}
              className={`min-h-11 rounded-xl text-sm font-semibold transition ${
                modo === f.id
                  ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                  : 'bg-white border border-[var(--c-borde)] text-neutral-600'
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>

        {modo === 'efectivo' && montoNota > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sugerenciasEfectivo(montoNota).map((v, i) => (
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
              placeholder={String(montoNota)}
              onChange={(e) => setRecibido(e.target.value)}
            />
            {cambio > 0 && (
              <p className="text-center rounded-xl bg-emerald-50 text-emerald-800 py-3 font-semibold">Cambio: {dinero(cambio)}</p>
            )}
          </div>
        )}

        {(modo === 'tarjeta' || modo === 'transferencia') && montoNota > 0 && (
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
            <p className={`text-sm text-center ${falta > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
              {falta > 0 ? `Faltan ${dinero(falta)}` : pagos ? 'Los pagos cubren lo necesario' : 'Escribe los montos'}
            </p>
          </div>
        )}

        <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={esNota}>
          <summary className="cursor-pointer font-medium min-h-8 flex items-center">
            {esNota ? 'Cliente *' : 'Cliente (opcional)'}
          </summary>
          <div className="mt-3">
            <BuscadorCliente inicial={clienteInicial?.vista} onCambio={(envio) => setCliente(envio)} />
            {faltaCliente && <p className="mt-2 text-xs text-amber-700">Escribe el teléfono y el nombre del cliente.</p>}
          </div>
        </details>

        {problema && !pagos && (modo !== 'mixto' || falta === 0 || esNota) && <p className="text-sm text-red-600">{problema}</p>}
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}