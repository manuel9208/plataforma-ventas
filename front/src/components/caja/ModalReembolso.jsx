import { useRef, useState } from 'react';
import { planReembolso } from '@plataforma/calculos';
import * as svc from '../../services/notas.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { autorizacionLista, cuerpoAutorizacion } from '../../utils/autorizacion.js';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import CamposAutorizacion from './CamposAutorizacion.jsx';
import CamposDevolucion from './CamposDevolucion.jsx';
import { dosDecimales, topeReembolso } from './ajustes.js';

// Reembolso suelto: se regresa dinero sin quitar el trabajo (Listo o Entregado)
export default function ModalReembolso({ nota, onListo, onCerrar }) {
  const { usuario, empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const puedeAutorizar = tienePermiso(usuario.permisos, 'notas.cancelar');
  const tope = topeReembolso(nota.valores, planReembolso);

  const [monto, setMonto] = useState('');
  const [forma, setForma] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [auth, setAuth] = useState({ pin: '', telefono: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se reembolsa dos veces
  const idOperacion = useRef(nuevoUuid());

  const valor = monto === '' ? 0 : dosDecimales(monto);
  const montoValido = valor > 0 && valor <= tope;
  const completo = montoValido && motivo.trim().length >= 3 && autorizacionLista(auth, puedeAutorizar) && !enviando;

  const reembolsar = async (e) => {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setError('');
    try {
      const r = await svc.reembolsar(nota.id, {
        id: idOperacion.current,
        monto: valor,
        forma,
        ...(referencia.trim() && forma !== 'efectivo' ? { referencia: referencia.trim() } : {}),
        motivo: motivo.trim(),
        autorizacion: cuerpoAutorizacion(auth, puedeAutorizar),
      });
      onListo(r);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Reembolsar dinero"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton type="submit" form="form-reembolso" className="flex-1" disabled={!completo} cargando={enviando}>
            {montoValido ? `Reembolsar ${dinero(valor)}` : 'Reembolsar'}
          </Boton>
        </>
      }
    >
      <form id="form-reembolso" onSubmit={reembolsar} className="space-y-5">
        <p className="text-sm text-neutral-600">
          Se regresa dinero al cliente sin quitar el trabajo, porque ya está Listo o Entregado. El saldo de la nota no cambia.
        </p>
        {tope > 0 ? (
          <>
            <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 text-sm flex justify-between">
              <span className="text-neutral-600">Máximo que se puede reembolsar</span>
              <span className="font-semibold">{dinero(tope)}</span>
            </div>
            <Campo
              etiqueta="¿Cuánto se reembolsa? *"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={tope}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              ayuda={valor > tope ? `No puede pasar de ${dinero(tope)}` : undefined}
            />
            <CamposDevolucion forma={forma} onForma={setForma} referencia={referencia} onReferencia={setReferencia} motivo={motivo} onMotivo={setMotivo} />
            <CamposAutorizacion valor={auth} onCambio={setAuth} puedeAutorizar={puedeAutorizar} />
          </>
        ) : (
          <p className="text-neutral-500">No hay dinero que se pueda reembolsar en esta nota.</p>
        )}
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}