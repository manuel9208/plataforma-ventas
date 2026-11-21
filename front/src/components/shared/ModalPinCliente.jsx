import Modal from './Modal.jsx';
import Boton from './Boton.jsx';

// Muestra el PIN una sola vez. Solo se cierra con el botón, para que no se pierda por un toque accidental.
export default function ModalPinCliente({ pin, nombre, reemplazo = false, onCerrar }) {
  return (
    <Modal
      abierto
      titulo={reemplazo ? 'PIN restablecido' : 'PIN del cliente'}
      onCerrar={() => {}}
      pie={
        <Boton className="flex-1" onClick={onCerrar}>
          Ya se lo di al cliente
        </Boton>
      }
    >
      <div className="space-y-4 text-center">
        <p className="text-neutral-600">
          PIN de <span className="font-semibold">{nombre}</span>
        </p>
        <div className="rounded-2xl border-2 border-dashed border-[var(--c-acento)] bg-amber-50/50 p-5">
          <p className="text-5xl font-semibold tracking-[0.3em]">{pin}</p>
        </div>
        <p className="text-sm text-neutral-500">
          Dáselo al cliente y dile que lo guarde. <strong>Esta es la única vez que se muestra</strong>: no se puede volver a ver.
          {reemplazo ? ' El PIN anterior ya no sirve.' : ''}
        </p>
      </div>
    </Modal>
  );
}