import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import { autorizacionLista, cuerpoAutorizacion } from '../../utils/autorizacion.js';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import CamposAutorizacion from './CamposAutorizacion.jsx';

// Anular un gasto o retiro del turno en curso: lo autoriza un gerente o administrador
export default function ModalAnularMovimiento({ movimiento, onAnular, onCerrar }) {
  const { usuario, empresa } = useAuth();
  const puedeAutorizar = tienePermiso(usuario.permisos, 'caja.administrar');
  const [motivo, setMotivo] = useState('');
  const [auth, setAuth] = useState({ pin: '', telefono: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const completo = motivo.trim().length >= 3 && autorizacionLista(auth, puedeAutorizar) && !enviando;
  const nombre = movimiento.tipo === 'retiro' ? 'Retiro de efectivo' : movimiento.concepto;

  const enviar = async (e) => {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setError('');
    try {
      await onAnular(movimiento.id, { motivo: motivo.trim(), autorizacion: cuerpoAutorizacion(auth, puedeAutorizar) });
      onCerrar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Anular movimiento"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton type="submit" form="form-anular" variante="peligro" className="flex-1" disabled={!completo} cargando={enviando}>
            Anular
          </Boton>
        </>
      }
    >
      <form id="form-anular" onSubmit={enviar} className="space-y-5">
        <p className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 text-sm">
          <span className="font-medium">{nombre}</span> · {formatearMoneda(movimiento.monto, empresa.moneda)}
        </p>
        <Campo etiqueta="Motivo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="¿Por qué se anula?" />
        <CamposAutorizacion valor={auth} onCambio={setAuth} puedeAutorizar={puedeAutorizar} />
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}