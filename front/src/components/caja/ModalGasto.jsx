import { useRef, useState } from 'react';
import { CATEGORIAS_GASTO, ETIQUETA_CATEGORIA } from '@plataforma/calculos';
import { nuevoUuid } from '../../utils/uuid.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

// Gasto en efectivo que sale de la caja (proveedor, insumos, servicios u otro)
export default function ModalGasto({ onCrear, onCerrar }) {
  const [categoria, setCategoria] = useState(null);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se registra dos veces
  const id = useRef(nuevoUuid());

  const valido = !!categoria && concepto.trim().length >= 3 && Number(monto) > 0;

  const enviar = async (e) => {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError('');
    try {
      await onCrear({
        id: id.current,
        tipo: 'gasto',
        categoria,
        concepto: concepto.trim(),
        monto: Number(monto),
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      });
      onCerrar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Registrar gasto"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-gasto" className="flex-1" disabled={!valido} cargando={enviando}>
            Registrar gasto
          </Boton>
        </>
      }
    >
      <form id="form-gasto" onSubmit={enviar} className="space-y-5">
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">¿Qué tipo de gasto es? *</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIAS_GASTO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={`min-h-12 px-3 rounded-xl text-sm font-semibold transition ${
                  categoria === c
                    ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                    : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                }`}
              >
                {ETIQUETA_CATEGORIA[c]}
              </button>
            ))}
          </div>
        </div>
        <Campo
          etiqueta="¿En qué se gastó? *"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          maxLength={120}
          placeholder="Ej. garrafón de agua, pago a proveedor de jabón"
        />
        <Campo
          etiqueta="¿Cuánto salió de la caja? *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3">
          <summary className="cursor-pointer font-medium min-h-8 flex items-center">Número de nota o factura (opcional)</summary>
          <div className="mt-3">
            <Campo etiqueta="Número" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={60} />
          </div>
        </details>
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}