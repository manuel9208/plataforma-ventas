import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCliente } from '../../context/ClienteContext.jsx';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import MensajeError from '../shared/MensajeError.jsx';

// Se muestra en el primer ingreso y no se cierra sin elegir
export default function ModalAvisoPrivacidad() {
  const { empresa } = useAuth();
  const { aceptarAviso, salir } = useCliente();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const aceptar = async () => {
    setGuardando(true);
    setError('');
    try {
      await aceptarAviso();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Aviso de privacidad"
      onCerrar={() => {}}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={salir}>
            No acepto
          </Boton>
          <Boton className="flex-1" cargando={guardando} onClick={aceptar}>
            Acepto
          </Boton>
        </>
      }
    >
      <div className="space-y-3 text-sm text-neutral-600">
        <p>
          {empresa.nombre} guarda tu nombre, teléfono, correo y cumpleaños para atenderte, mostrarte cómo van tus pedidos y llevar tu historial de compras.
        </p>
        <p>Si algún día quieres recibir promociones, te lo preguntaremos aparte.</p>
        <p>Puedes pedir en tu sucursal que corrijamos tus datos.</p>
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}