import { useState } from 'react';
import * as svc from '../../services/clientes.service.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import CampoCumpleanos from '../shared/CampoCumpleanos.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import ModalPinCliente from '../shared/ModalPinCliente.jsx';
import { actualizarVista, conPin } from './vistaCliente.js';

// cliente: vista con id · onCambio(vista) avisa a la Caja cada vez que algo se guarda
export default function ModalCompletarCliente({ cliente, onCambio, onCerrar }) {
  const [vista, setVista] = useState(cliente);
  const [correo, setCorreo] = useState(cliente.correo ?? '');
  const [cumple, setCumple] = useState(cliente.cumpleanos ?? null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [pinNuevo, setPinNuevo] = useState(null);

  // Solo se manda lo que cambió y lo que tiene dato
  const correoLimpio = correo.trim().toLowerCase();
  const cambios = {};
  if (correoLimpio && correoLimpio !== (vista.correo ?? '')) cambios.correo = correoLimpio;
  if (cumple && (cumple.mes !== vista.cumpleanos?.mes || cumple.dia !== vista.cumpleanos?.dia)) cambios.cumpleanos = cumple;
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    setError('');
    setGuardando(true);
    try {
      await svc.actualizar(vista.id, cambios);
      const nueva = actualizarVista(vista, cambios);
      setVista(nueva);
      onCambio(nueva);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const generarPin = async () => {
    setError('');
    setGenerando(true);
    try {
      const r = await svc.generarPin(vista.id);
      const nueva = conPin(vista);
      setVista(nueva);
      onCambio(nueva);
      setPinNuevo(r.pin);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const falta = vista.perfil.falta;

  return (
    <>
      <Modal
        abierto
        titulo="Completar datos del cliente"
        onCerrar={onCerrar}
        pie={
          <>
            <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
              Listo
            </Boton>
            <Boton className="flex-1" disabled={!hayCambios} cargando={guardando} onClick={guardar}>
              Guardar datos
            </Boton>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="font-semibold">{vista.nombre}</p>
            <p className={`text-sm ${vista.perfil.completo ? 'text-emerald-700' : 'text-amber-700'}`}>
              {vista.perfil.completo ? 'Perfil completo' : `Falta: ${falta.join(', ')}`}
            </p>
          </div>

          <Campo etiqueta="Correo" type="email" autoCapitalize="none" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <CampoCumpleanos valor={cumple} onCambio={setCumple} ayuda="Solo día y mes, sin año." />

          <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-3">
            <p className="text-sm font-medium">PIN del cliente</p>
            {vista.tienePin ? (
              <p className="text-sm text-neutral-500">Ya tiene PIN. Si lo olvidó, un gerente o administrador lo restablece desde Clientes.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-500">Se genera uno de 4 dígitos. Se muestra una sola vez: dáselo al cliente.</p>
                <Boton compacto variante="secundario" cargando={generando} onClick={generarPin}>
                  Generar PIN
                </Boton>
              </>
            )}
          </div>

          <MensajeError error={error} />
        </div>
      </Modal>

      {pinNuevo && <ModalPinCliente pin={pinNuevo} nombre={vista.nombre} onCerrar={() => setPinNuevo(null)} />}
    </>
  );
}