import { useState } from 'react';
import { valorPuntos } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

// puntos: carrito.puntos · puedeAutorizar: quien cobra tiene caja.descuentos (usa su propio PIN)
export default function PuntosEnCobro({ puntos, puedeAutorizar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { info, limite, actual, error: errorCarrito } = puntos;

  const [cantidad, setCantidad] = useState('');
  const [metodo, setMetodo] = useState(info.tienePin ? 'cliente' : 'encargado');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const aplicar = () => {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1) return setError('Escribe los puntos con números enteros');
    if (n < limite.minPuntos) return setError(`El mínimo para canjear es de ${limite.minPuntos} puntos`);
    if (n > limite.maxPuntos) return setError(`En esta compra se pueden usar hasta ${limite.maxPuntos} puntos`);
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos');
    if (metodo === 'encargado' && !puedeAutorizar && telefono.length !== 10) return setError('Escribe el teléfono del encargado (10 dígitos)');
    puntos.aplicar(n, metodo === 'cliente' ? { pinCliente: pin } : { autorizacion: { ...(puedeAutorizar ? {} : { telefono }), pin } });
    setPin('');
    setError('');
  };

  return (
    <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={Boolean(actual || errorCarrito)}>
      <summary className="cursor-pointer font-medium min-h-8 flex items-center justify-between gap-3">
        <span>Usar puntos</span>
        <span className="text-sm font-normal text-neutral-500">
          {info.saldo} puntos · {dinero(valorPuntos(info.saldo, info.ajustes.valor))}
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        {actual || errorCarrito ? (
          <div className={`rounded-xl p-3 text-sm ${errorCarrito ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <p className="font-semibold">
              {errorCarrito ? `Los puntos ya no aplican: ${errorCarrito}` : `Se usan ${actual.puntos} puntos · −${dinero(actual.descuento)}`}
            </p>
            <button type="button" onClick={puntos.quitar} className="mt-1 font-semibold underline underline-offset-2">
              Quitar puntos
            </button>
          </div>
        ) : !limite?.puedeCanjear ? (
          <p className="text-sm text-neutral-500">
            {info.saldo < (limite?.minPuntos ?? 1)
              ? `Necesita al menos ${limite?.minPuntos ?? 1} puntos para canjear.`
              : 'En esta compra no se pueden usar puntos (puede ser por una promoción o un descuento).'}
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-500">
              En esta compra puede usar de {limite.minPuntos} a {limite.maxPuntos} puntos (hasta {dinero(valorPuntos(limite.maxPuntos, info.ajustes.valor))}).
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Campo
                  etiqueta="¿Cuántos puntos usa?"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={cantidad}
                  onChange={(e) => {
                    setCantidad(soloDigitos(e.target.value, 7));
                    setError('');
                  }}
                />
              </div>
              <Boton compacto variante="secundario" onClick={() => setCantidad(String(limite.maxPuntos))}>
                Máximo
              </Boton>
            </div>

            {info.tienePin ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cliente', nombre: 'PIN del cliente' },
                  { id: 'encargado', nombre: 'Un encargado' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMetodo(m.id);
                      setError('');
                    }}
                    className={`min-h-11 rounded-xl text-sm font-semibold transition ${
                      metodo === m.id
                        ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                        : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                    }`}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-700">Este cliente aún no tiene PIN. Un encargado puede autorizar, o genera su PIN en Clientes.</p>
            )}

            {metodo === 'encargado' && !puedeAutorizar && (
              <Campo
                etiqueta="Teléfono del encargado *"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={telefono}
                onChange={(e) => {
                  setTelefono(soloDigitos(e.target.value, 10));
                  setError('');
                }}
              />
            )}
            <Campo
              etiqueta={metodo === 'cliente' ? 'PIN del cliente *' : puedeAutorizar ? 'Tu PIN *' : 'PIN del encargado *'}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(soloDigitos(e.target.value, 4));
                setError('');
              }}
            />
            <MensajeError error={error} />
            <Boton className="w-full" onClick={aplicar}>
              Aplicar puntos
            </Boton>
          </>
        )}
      </div>
    </details>
  );
}