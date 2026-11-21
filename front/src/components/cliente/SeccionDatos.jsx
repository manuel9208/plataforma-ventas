import { useState } from 'react';
import * as svc from '../../services/miCuenta.service.js';
import { useCliente } from '../../context/ClienteContext.jsx';
import { formatearTelefono } from '../../utils/formato.js';
import { textoCumple } from '../../utils/cumpleanos.js';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import CampoCumpleanos from '../shared/CampoCumpleanos.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const soloPin = (v) => v.replace(/\D/g, '').slice(0, 4);

export default function SeccionDatos() {
  const { cliente, actualizar } = useCliente();
  const [correo, setCorreo] = useState(cliente.correo ?? '');
  const [cumple, setCumple] = useState(cliente.cumpleanos ?? null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Solo se manda lo que cambió
  const correoLimpio = correo.trim().toLowerCase();
  const cambios = {};
  if (correoLimpio && correoLimpio !== (cliente.correo ?? '')) cambios.correo = correoLimpio;
  if (cumple && (cumple.mes !== cliente.cumpleanos?.mes || cumple.dia !== cliente.cumpleanos?.dia)) cambios.cumpleanos = cumple;
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardado(false);
    setGuardando(true);
    try {
      actualizar(await svc.actualizarDatos({ pin, ...cambios }));
      setPin('');
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 space-y-2">
        <p className="text-xs text-neutral-500">Nombre</p>
        <p className="font-semibold">{cliente.nombre}</p>
        <p className="text-xs text-neutral-500 pt-2">Teléfono</p>
        <p className="font-semibold">{formatearTelefono(cliente.telefono)}</p>
        <p className="text-xs text-neutral-400 pt-2">Para cambiar tu nombre o tu teléfono, acude a tu sucursal.</p>
      </div>

      <form onSubmit={guardar} className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 space-y-4">
        <h3 className="font-semibold tracking-tight">Tus datos de contacto</h3>
        <p className={`text-sm ${cliente.perfil.completo ? 'text-emerald-700' : 'text-amber-700'}`}>
          {cliente.perfil.completo ? 'Tu perfil está completo.' : `Falta: ${cliente.perfil.falta.join(', ')}.`}
        </p>
        <Campo etiqueta="Correo" type="email" autoCapitalize="none" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <CampoCumpleanos
          valor={cumple}
          onCambio={setCumple}
          ayuda={cliente.cumpleanos ? `Hoy guardado: ${textoCumple(cliente.cumpleanos)}. Solo día y mes.` : 'Solo día y mes, sin año.'}
        />
        <Campo
          etiqueta="Tu PIN para confirmar"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="4 dígitos"
          value={pin}
          onChange={(e) => setPin(soloPin(e.target.value))}
          autoComplete="current-password"
        />
        <MensajeError error={error} />
        {guardado && <p className="text-sm text-emerald-700">Datos guardados.</p>}
        <Boton type="submit" className="w-full" cargando={guardando} disabled={!hayCambios || pin.length !== 4}>
          Guardar cambios
        </Boton>
      </form>
    </div>
  );
}