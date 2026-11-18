import { useState } from 'react';
import { formatearMoneda } from '../../utils/formato.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

export default function AperturaTurno({ estado, onAbrir }) {
  const { empresa } = useAuth();
  const [fondo, setFondo] = useState(estado.fondoSugerido === null ? '' : String(estado.fondoSugerido));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await onAbrir(Number(fondo));
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="max-w-md rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)] space-y-4"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Abrir turno</h2>
        <p className="text-sm text-neutral-500 mt-1">
          {estado.caja.nombre} · {estado.caja.sucursal}
        </p>
      </div>
      <Campo
        etiqueta="¿Con cuánto efectivo empiezas? *"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={fondo}
        onChange={(e) => setFondo(e.target.value)}
        ayuda={
          estado.fondoSugerido === null
            ? 'Cuenta el efectivo que hay en la caja. Si no hay, escribe 0.'
            : `El turno anterior dejó ${formatearMoneda(estado.fondoSugerido, empresa.moneda)}. Cuéntalo y corrige si no coincide.`
        }
        required
      />
      <MensajeError error={error} />
      <Boton type="submit" cargando={guardando} className="w-full">
        Abrir turno
      </Boton>
    </form>
  );
}