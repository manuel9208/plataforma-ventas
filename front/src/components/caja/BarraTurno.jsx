import { useState } from 'react';
import { formatearFechaLarga, formatearHora } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import ModalCorte from './ModalCorte.jsx';

export default function BarraTurno({ estado, bloqueado, onCerrar }) {
  const { turno, caja } = estado;
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const hacerCorte = async (datos) => {
    setEnviando(true);
    setError('');
    try {
      await onCerrar(turno.id, datos);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white border border-[var(--c-borde)] px-3 py-2 mb-3">
        <p className="text-sm text-neutral-600 truncate">
          <span className="font-semibold text-neutral-900">{caja.nombre}</span> · {caja.sucursal}
          <span className="hidden sm:inline">
            {' '}
            · desde {formatearFechaLarga(turno.fechaOperativa)}, {formatearHora(turno.abiertoEn, turno.zonaHoraria)}
          </span>
        </p>
        <Boton
          compacto
          variante="secundario"
          className="shrink-0 whitespace-nowrap"
          disabled={bloqueado}
          onClick={() => {
            setError('');
            setAbierto(true);
          }}
        >
          Hacer corte
        </Boton>
      </div>
      {abierto && (
        <ModalCorte
          descripcion="Cuenta el efectivo de tu caja. Al terminar se cierra tu turno y para vender otra vez tendrás que abrir uno nuevo."
          enviando={enviando}
          error={error}
          onConfirmar={hacerCorte}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}