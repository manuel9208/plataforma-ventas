import { useState } from 'react';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import BuscadorCliente from './BuscadorCliente.jsx';

// inicial: { envio, vista } o null · onAceptar(envio, vista) · onAceptar(null) quita el cliente
export default function ModalCliente({ inicial, onAceptar, onCerrar }) {
  const [c, setC] = useState(inicial ?? null);

  return (
    <Modal
      abierto
      titulo="Cliente de la nota"
      onCerrar={onCerrar}
      pie={
        <>
          {inicial ? (
            <Boton variante="secundario" className="flex-1" onClick={() => onAceptar(null)}>
              Quitar
            </Boton>
          ) : (
            <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
              Cancelar
            </Boton>
          )}
          <Boton className="flex-1" disabled={!c} onClick={() => onAceptar(c.envio, c.vista)}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="space-y-3">
        <BuscadorCliente inicial={inicial?.vista} onCambio={(envio, vista) => setC(envio ? { envio, vista } : null)} />
        <p className="text-xs text-neutral-500">Busca por teléfono o nombre. Si no existe, escribe los dos datos y se registra al cobrar.</p>
      </div>
    </Modal>
  );
}