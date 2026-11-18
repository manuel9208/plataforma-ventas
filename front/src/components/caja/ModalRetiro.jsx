import { useRef, useState } from 'react';
import { nuevoUuid } from '../../utils/uuid.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

// Sacar efectivo de la caja a mitad del turno. sugerido = lo que avisa la caja (si lo hay).
export default function ModalRetiro({ sugerido = null, onCrear, onCerrar }) {
  const [monto, setMonto] = useState(sugerido ? String(sugerido) : '');
  const [recibe, setRecibe] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se registra dos veces
  const id = useRef(nuevoUuid());

  const valido = Number(monto) > 0 && recibe.trim().length >= 2;

  const enviar = async (e) => {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError('');
    try {
      await onCrear({ id: id.current, tipo: 'retiro', recibe: recibe.trim(), monto: Number(monto) });
      onCerrar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Retirar efectivo"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-retiro" className="flex-1" disabled={!valido} cargando={enviando}>
            Registrar retiro
          </Boton>
        </>
      }
    >
      <form id="form-retiro" onSubmit={enviar} className="space-y-5">
        <p className="text-neutral-600">Saca el efectivo de la caja y anota quién lo recibe. Queda registrado con tu nombre y la hora.</p>
        <Campo
          etiqueta="¿Cuánto retiras? *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          autoFocus
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Campo
          etiqueta="¿Quién recibe el efectivo? *"
          value={recibe}
          onChange={(e) => setRecibe(e.target.value)}
          maxLength={80}
          placeholder="Nombre de quien se lo lleva"
        />
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}