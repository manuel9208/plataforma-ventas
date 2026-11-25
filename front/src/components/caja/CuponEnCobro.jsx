import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import { textoError } from '../../utils/textoError.js';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const limpiar = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

// cupon: carrito.cupon · hayPuntos: ya se están usando puntos (un cupón los quita)
export default function CuponEnCobro({ cupon, hayPuntos = false }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { actual, error: errorCarrito, info } = cupon;

  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);

  const aplicar = async () => {
    if (codigo.length < 3) return setError('Escribe el código del cupón');
    setVerificando(true);
    try {
      await cupon.aplicar(codigo);
      setCodigo('');
      setError('');
    } catch (e) {
      setError(textoError(e));
    } finally {
      setVerificando(false);
    }
  };

  return (
    <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={Boolean(actual || errorCarrito)}>
      <summary className="cursor-pointer font-medium min-h-8 flex items-center justify-between gap-3">
        <span>Tengo un cupón</span>
        {info && <span className="text-sm font-normal text-neutral-500 font-mono tracking-wider">{info.codigo}</span>}
      </summary>

      <div className="mt-3 space-y-3">
        {actual || errorCarrito ? (
          <div className={`rounded-xl p-3 text-sm ${errorCarrito ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <p className="font-semibold">{errorCarrito || `Cupón ${info.codigo} · −${dinero(actual.descuento)}`}</p>
            <button type="button" onClick={cupon.quitar} className="mt-1 font-semibold underline underline-offset-2">
              Quitar cupón
            </button>
          </div>
        ) : (
          <>
            <Campo
              etiqueta="Código del cupón"
              value={codigo}
              maxLength={20}
              onChange={(e) => {
                setCodigo(limpiar(e.target.value));
                setError('');
              }}
              ayuda={hayPuntos ? 'Si aplicas un cupón se quitan los puntos: no se juntan.' : 'Un cupón no se junta con promociones, descuentos ni puntos.'}
            />
            <MensajeError error={error} />
            <Boton className="w-full" cargando={verificando} onClick={aplicar}>
              Aplicar cupón
            </Boton>
          </>
        )}
      </div>
    </details>
  );
}