import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearHora, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';
import MensajeError from '../shared/MensajeError.jsx';

export default function EstadoTurno({ estado, onCerrar }) {
  const { empresa } = useAuth();
  const { turno, caja } = estado;
  const [confirmar, setConfirmar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cerrar = async () => {
    setProcesando(true);
    setError('');
    try {
      await onCerrar(turno.id);
    } catch (e) {
      setError(e.message);
      setConfirmar(false);
      setProcesando(false);
    }
  };

  const fecha = formatearFechaLarga(turno.fechaOperativa);

  return (
    <div className="space-y-4 max-w-2xl">
      {estado.turnoVencido && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
          Este turno se abrió el {fecha} y sigue abierto. Ciérralo para poder abrir uno nuevo. Al cerrarlo conservará la fecha del {fecha} y quedará marcado como cierre tardío.
        </p>
      )}

      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c-acento)]">Turno abierto</p>
        <h2 className="text-xl font-semibold tracking-tight mt-1">
          {caja.nombre} · {caja.sucursal}
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-400">Abierto el</dt>
            <dd className="font-medium">
              {fecha}, {formatearHora(turno.abiertoEn, turno.zonaHoraria)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-400">Fondo inicial</dt>
            <dd className="font-medium">{formatearMoneda(turno.fondoInicial, empresa.moneda)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <MensajeError error={error} />
        </div>
        <Boton variante="secundario" className="w-full mt-4" onClick={() => setConfirmar(true)}>
          Cerrar turno
        </Boton>
      </div>

      <p className="text-sm text-neutral-400">Las ventas y los cobros llegan en la siguiente etapa.</p>

      <ConfirmModal
        abierto={confirmar}
        titulo="Cerrar turno"
        mensaje={
          estado.turnoVencido
            ? `Se cerrará con la fecha del ${fecha} y quedará marcado como cierre tardío.`
            : 'Se cerrará tu turno. Para abrir otro tendrás que declarar de nuevo el efectivo con el que empiezas.'
        }
        textoConfirmar="Cerrar turno"
        peligro
        cargando={procesando}
        onConfirmar={cerrar}
        onCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}