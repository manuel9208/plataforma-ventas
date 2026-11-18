import { useState } from 'react';
import { textoError } from '../../../utils/textoError.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

export default function ModalBajaPromocion({ promocion, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      await onConfirmar(motivo.trim());
      onCerrar();
    } catch (e) {
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Dar de baja la promoción"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" disabled={motivo.trim().length < 3} cargando={enviando} onClick={confirmar}>
            Dar de baja
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-neutral-600">
          “{promocion.nombre}” dejará de aplicarse. Las ventas que ya se hicieron no cambian, y la promoción no se borra: queda en el historial.
        </p>
        <Campo etiqueta="Motivo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="¿Por qué se da de baja?" />
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}