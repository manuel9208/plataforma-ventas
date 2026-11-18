import { useState } from 'react';
import { validarConteo } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

// Corte ciego: solo se pide lo contado y lo que se deja. No muestra lo esperado ni la diferencia.
export default function ModalCorte({ titulo = 'Hacer corte', descripcion, enviando = false, error = '', onConfirmar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const [contado, setContado] = useState('');
  const [dejado, setDejado] = useState('');

  let conteo = null;
  let problema = '';
  if (contado !== '' && dejado !== '' && Number.isFinite(Number(contado)) && Number.isFinite(Number(dejado))) {
    try {
      conteo = validarConteo({ contado: Number(contado), dejado: Number(dejado) });
    } catch (e) {
      problema = e.message;
    }
  }

  const enviar = (e) => {
    e.preventDefault();
    if (!conteo || enviando) return;
    onConfirmar({ efectivoContado: conteo.contado, dejadoManana: conteo.dejado });
  };

  return (
    <Modal
      abierto
      titulo={titulo}
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-corte" className="flex-1" disabled={!conteo} cargando={enviando}>
            Hacer corte
          </Boton>
        </>
      }
    >
      <form id="form-corte" onSubmit={enviar} className="space-y-5">
        {descripcion && <p className="text-neutral-600">{descripcion}</p>}
        <Campo
          etiqueta="¿Cuánto efectivo hay en la caja? *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          autoFocus
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          ayuda="Cuenta todo el efectivo, incluido con el que empezaste."
        />
        <Campo
          etiqueta="¿Cuánto dejas para mañana? *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={dejado}
          onChange={(e) => setDejado(e.target.value)}
          ayuda="Es el efectivo que se queda en la caja para empezar el siguiente turno."
        />
        {conteo && (
          <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 text-center">
            <p className="text-sm text-neutral-500">A entregar</p>
            <p className="text-3xl font-semibold tracking-tight">{dinero(conteo.entregado)}</p>
          </div>
        )}
        {problema && <p className="text-sm text-red-600">{problema}</p>}
        <p className="text-xs text-neutral-500">El corte no se puede editar después. Revisa bien los montos.</p>
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}