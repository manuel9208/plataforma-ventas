import { useState } from 'react';
import { pinDebil } from '@plataforma/calculos';
import * as svc from '../../services/miCuenta.service.js';
import { useCliente } from '../../context/ClienteContext.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const soloPin = (v) => v.replace(/\D/g, '').slice(0, 4);

export default function SeccionPin() {
  const { guardarToken } = useCliente();
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const problema =
    nuevo.length === 4 && pinDebil(nuevo)
      ? 'Elige un PIN menos obvio (nada de 1234 ni 1111).'
      : nuevo.length === 4 && nuevo === actual
        ? 'El PIN nuevo debe ser distinto al actual.'
        : repite.length === 4 && repite !== nuevo
          ? 'Los dos PIN nuevos no son iguales.'
          : '';
  const puede = actual.length === 4 && nuevo.length === 4 && repite === nuevo && !problema;

  const cambiar = async (e) => {
    e.preventDefault();
    setError('');
    setListo(false);
    setGuardando(true);
    try {
      const r = await svc.cambiarPin({ pinActual: actual, pinNuevo: nuevo });
      guardarToken(r.token); // la sesión anterior ya no sirve
      setActual('');
      setNuevo('');
      setRepite('');
      setListo(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (etiqueta, valor, set, auto) => (
    <Campo
      etiqueta={etiqueta}
      type="password"
      inputMode="numeric"
      maxLength={4}
      placeholder="4 dígitos"
      value={valor}
      onChange={(e) => set(soloPin(e.target.value))}
      autoComplete={auto}
    />
  );

  return (
    <form onSubmit={cambiar} className="max-w-xl rounded-3xl bg-white border border-[var(--c-borde)] p-5 space-y-4">
      <h3 className="font-semibold tracking-tight">Cambiar mi PIN</h3>
      {campo('PIN actual', actual, setActual, 'current-password')}
      {campo('PIN nuevo', nuevo, setNuevo, 'new-password')}
      {campo('Repite el PIN nuevo', repite, setRepite, 'new-password')}
      {problema && <p className="text-sm text-amber-700">{problema}</p>}
      <MensajeError error={error} />
      {listo && <p className="text-sm text-emerald-700">PIN cambiado. La próxima vez entra con el nuevo.</p>}
      <Boton type="submit" className="w-full" cargando={guardando} disabled={!puede}>
        Cambiar PIN
      </Boton>
      <p className="text-xs text-neutral-500">Si olvidaste tu PIN, pide en tu sucursal que te den uno nuevo.</p>
    </form>
  );
}