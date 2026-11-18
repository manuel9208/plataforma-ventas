import { useState } from 'react';
import Modal from './Modal.jsx';
import Boton from './Boton.jsx';
import Campo from './Campo.jsx';
import MensajeError from './MensajeError.jsx';

// Se muestra solo mientras hace falta (renderízalo con una condición) para que el texto se reinicie
export default function ModalMotivo({
  titulo,
  mensaje,
  etiqueta = 'Motivo *',
  textoConfirmar = 'Confirmar',
  peligro = true,
  cargando = false,
  error = '',
  onConfirmar,
  onCancelar,
}) {
  const [motivo, setMotivo] = useState('');

  return (
    <Modal
      abierto
      titulo={titulo}
      onCerrar={onCancelar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="form-motivo"
            variante={peligro ? 'peligro' : 'primario'}
            className="flex-1"
            cargando={cargando}
          >
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <form
        id="form-motivo"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar(motivo.trim());
        }}
      >
        <p className="text-neutral-600">{mensaje}</p>
        <Campo etiqueta={etiqueta} value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={3} maxLength={200} required />
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}