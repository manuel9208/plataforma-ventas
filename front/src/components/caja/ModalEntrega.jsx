import { useRef, useState } from 'react';
import * as svc from '../../services/notas.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import { nuevoUuid } from '../../utils/uuid.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

// Entrega de los artículos Listos. El servidor vuelve a revisar todo (saldo, estado, PIN).
export default function ModalEntrega({ nota, onEntregada, onCerrar }) {
  const { usuario } = useAuth();
  const listos = nota.servicios.filter((s) => s.estado === 'listo');
  const pideSuPin = nota.pinEntregaActivo && nota.tienePin;
  const puedeAutorizar = tienePermiso(usuario.permisos, 'caja.autorizar_entrega');

  const [elegidos, setElegidos] = useState(() => listos.map((s) => s.partidaId));
  const [pin, setPin] = useState('');
  const [recoge, setRecoge] = useState('');
  // Si la nota no tiene PIN guardado, se entra directo a la autorización del encargado
  const [autoriza, setAutoriza] = useState(nota.pinEntregaActivo && !nota.tienePin);
  const [telefono, setTelefono] = useState('');
  const [pinEncargado, setPinEncargado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se entrega dos veces
  const idEntrega = useRef(nuevoUuid());

  const alternar = (id) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const faltaPin = autoriza
    ? pinEncargado.length !== 4 || motivo.trim().length < 3 || (!puedeAutorizar && telefono.length !== 10)
    : nota.pinEntregaActivo && pin.length !== 4;
  const recogeCorto = recoge.trim().length === 1;
  const puedeEntregar = elegidos.length > 0 && !faltaPin && !recogeCorto && !enviando;

  const entregar = async (e) => {
    e.preventDefault();
    if (!puedeEntregar) return;
    setEnviando(true);
    setError('');
    try {
      const cuerpo = {
        id: idEntrega.current,
        partidaIds: elegidos,
        ...(recoge.trim() ? { recoge: recoge.trim() } : {}),
      };
      if (autoriza) {
        cuerpo.autorizacion = { ...(puedeAutorizar ? {} : { telefono }), pin: pinEncargado, motivo: motivo.trim() };
      } else if (nota.pinEntregaActivo) {
        cuerpo.pin = pin;
      }
      onEntregada(await svc.entregar(nota.id, cuerpo));
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Entregar"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-entrega" className="flex-1" disabled={!puedeEntregar} cargando={enviando}>
            {elegidos.length > 1 ? `Entregar ${elegidos.length} artículos` : 'Entregar'}
          </Boton>
        </>
      }
    >
      <form id="form-entrega" onSubmit={entregar} className="space-y-5">
        <fieldset>
          <legend className="text-sm font-medium text-neutral-600 mb-2">¿Qué se lleva el cliente?</legend>
          <div className="space-y-2">
            {listos.map((s) => {
              const datos = Object.values(s.articulo).join(' · ');
              return (
                <label key={s.partidaId} className="flex items-start gap-3 rounded-2xl border border-[var(--c-borde)] bg-[#faf8f3] p-3 min-h-14">
                  <input
                    type="checkbox"
                    className="size-5 mt-0.5 accent-[var(--c-primario)]"
                    checked={elegidos.includes(s.partidaId)}
                    onChange={() => alternar(s.partidaId)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{s.nombre}</span>
                    {datos && <span className="block text-xs text-neutral-500">{datos}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {!autoriza && nota.pinEntregaActivo && (
          <div>
            <Campo
              etiqueta="PIN del cliente *"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(soloDigitos(e.target.value, 4))}
              placeholder="4 dígitos"
              className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
            />
            <button
              type="button"
              onClick={() => {
                setError('');
                setAutoriza(true);
              }}
              className="mt-2 min-h-10 text-sm font-medium text-[var(--c-primario-2)] underline underline-offset-4"
            >
              El cliente no tiene su PIN
            </button>
          </div>
        )}

        {!nota.pinEntregaActivo && (
          <p className="rounded-xl bg-[#f3efe6] px-4 py-3 text-sm text-neutral-600">
            Esta sucursal no pide PIN. Solo confirma quién recoge.
          </p>
        )}

        {autoriza && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
            <div>
              <p className="font-medium">Autorización de un encargado</p>
              <p className="text-sm text-neutral-600">
                {puedeAutorizar
                  ? 'Tú puedes autorizar: escribe tu PIN de empleado y el motivo.'
                  : 'Pide a un jefe, gerente o administrador que escriba su teléfono y su PIN.'}
              </p>
            </div>
            {!puedeAutorizar && (
              <Campo
                etiqueta="Teléfono del encargado *"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={telefono}
                onChange={(e) => setTelefono(soloDigitos(e.target.value, 10))}
                placeholder="10 dígitos"
              />
            )}
            <Campo
              etiqueta={puedeAutorizar ? 'Tu PIN de empleado *' : 'PIN del encargado *'}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinEncargado}
              onChange={(e) => setPinEncargado(soloDigitos(e.target.value, 4))}
              placeholder="4 dígitos"
            />
            <Campo
              etiqueta="Motivo *"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ej. el cliente perdió su ticket"
            />
            {nota.pinEntregaActivo && nota.tienePin && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setAutoriza(false);
                }}
                className="min-h-10 text-sm font-medium text-[var(--c-primario-2)] underline underline-offset-4"
              >
                Volver al PIN del cliente
              </button>
            )}
          </div>
        )}

        <Campo
          etiqueta="¿Quién recoge? (opcional)"
          value={recoge}
          onChange={(e) => setRecoge(e.target.value)}
          maxLength={80}
          placeholder="Solo si no es el titular de la nota"
          ayuda={recogeCorto ? 'Escribe al menos 2 letras' : 'Queda anotado en el ticket de entrega.'}
        />

        <MensajeError error={error} />
      </form>
    </Modal>
  );
}