import { useState } from 'react';
import { textoError } from '../../../utils/textoError.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

export default function ModalBajaCupon({ cupon, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (motivo.trim().length < 3) return setError('Escribe el motivo');
    setEnviando(true);
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
      titulo="Dar de baja el cupón"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" cargando={enviando} onClick={confirmar}>
            Dar de baja
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          El cupón <span className="font-semibold">{cupon.nombre}</span> ({cupon.codigo}) dejará de funcionar. No se borra: queda guardado con su historial.
        </p>
        <Campo
          etiqueta="Motivo *"
          value={motivo}
          maxLength={200}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError('');
          }}
        />
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}