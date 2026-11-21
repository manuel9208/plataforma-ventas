import Modal from '../shared/Modal.jsx';

function Opcion({ titulo, detalle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-16 px-5 py-3 rounded-2xl border border-[var(--c-borde)] bg-white text-left transition hover:border-[var(--c-acento)]"
    >
      <span className="block font-semibold">{titulo}</span>
      <span className="block text-sm text-neutral-500">{detalle}</span>
    </button>
  );
}

// onElegir('cliente' | 'empleado'). No se adivina quién es empleado: lo elige la persona.
export default function ModalEntrar({ onElegir, onCerrar }) {
  return (
    <Modal abierto titulo="¿Cómo quieres entrar?" onCerrar={onCerrar}>
      <div className="grid gap-3">
        <Opcion titulo="Soy cliente" detalle="Mira cómo van tus pedidos y tus datos." onClick={() => onElegir('cliente')} />
        <Opcion titulo="Soy empleado" detalle="Entra a Caja o a Administración." onClick={() => onElegir('empleado')} />
      </div>
    </Modal>
  );
}