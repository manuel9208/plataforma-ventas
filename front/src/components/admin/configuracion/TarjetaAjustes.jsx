import { useState } from 'react';
import { textoError } from '../../../utils/textoError.js';
import Boton from '../../shared/Boton.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import CampoAjuste from './CampoAjuste.jsx';

// Un grupo de ajustes (Qué vendo, Cobro, Tickets) con su propio botón Guardar
export default function TarjetaAjustes({ grupo, enSucursal, puedeEditar, variablesPie, onGuardar }) {
  const [borrador, setBorrador] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);

  const poner = (clave, valor) => {
    setGuardado(false);
    setBorrador((b) => {
      const n = { ...b };
      if (valor === undefined) delete n[clave];
      else n[clave] = valor;
      return n;
    });
  };

  const hayCambios = Object.keys(borrador).length > 0;

  const guardar = async () => {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar(borrador);
      setBorrador({});
      setGuardado(true);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <li
      className={`rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col ${
        grupo.ancho ? 'sm:col-span-2 xl:col-span-3' : ''
      }`}
    >
      <p className="text-lg font-semibold tracking-tight">{grupo.nombre}</p>
      <p className="text-sm text-neutral-500">{grupo.descripcion}</p>

      <div className="mt-4 space-y-5">
        {grupo.ajustes.map((a) => (
          <CampoAjuste
            key={a.clave}
            a={a}
            borrador={borrador[a.clave]}
            onCambio={(v) => poner(a.clave, v)}
            enSucursal={enSucursal}
            variablesPie={variablesPie}
          />
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <MensajeError error={error} />
        </div>
      )}
      {guardado && !hayCambios && <p className="mt-3 text-sm text-emerald-700">Cambios guardados</p>}

      {puedeEditar && (
        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] mt-auto">
          <Boton className="w-full" compacto disabled={!hayCambios} cargando={guardando} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      )}
    </li>
  );
}