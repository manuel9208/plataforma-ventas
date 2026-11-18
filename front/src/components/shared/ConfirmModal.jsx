import Modal from './Modal.jsx';
import Boton from './Boton.jsx';

export default function ConfirmModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  peligro = false,
  cargando = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
            Cancelar
          </Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} className="flex-1" cargando={cargando} onClick={onConfirmar}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <p className="text-neutral-600">{mensaje}</p>
    </Modal>
  );
}