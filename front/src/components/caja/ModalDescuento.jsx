import { useState } from 'react';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const RAPIDOS = [5, 10, 15, 20];
const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);
const dosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// objetivo: { clave, nombre } del artículo, o { clave: null } para volver a pedir solo la autorización.
// Cada descuento pide el PIN de un encargado: el servidor lo revisa de nuevo al cobrar.
export default function ModalDescuento({ carrito, max, puedeAutorizar, objetivo, onCerrar }) {
  const soloAutorizar = !objetivo?.clave;
  const [pct, setPct] = useState(soloAutorizar ? '' : String(carrito.porcentajeDe(objetivo.clave) ?? ''));
  const [todas, setTodas] = useState(false);
  const [motivo, setMotivo] = useState(carrito.motivoManual ?? '');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const rapidos = [...RAPIDOS.filter((p) => p <= max), ...(RAPIDOS.includes(max) ? [] : [max])];

  const aceptar = () => {
    const n = Number(pct);
    if (!soloAutorizar) {
      if (!(n > 0)) return setError('Escribe el porcentaje de descuento');
      if (n > max) return setError(`El máximo permitido es ${max}%`);
      if (!dosDecimales(n)) return setError('Máximo 2 decimales');
    }
    if (motivo.trim().length < 3) return setError('Escribe el motivo del descuento');
    if (!puedeAutorizar && telefono.length !== 10) return setError('Escribe el teléfono del encargado (10 dígitos)');
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos');

    const auth = { motivo: motivo.trim(), pin, ...(puedeAutorizar ? {} : { telefono }) };
    if (soloAutorizar) carrito.ponerAutorizacion(auth);
    else carrito.ponerDescuento(todas ? carrito.claves : [objetivo.clave], n, auth);
    onCerrar();
  };

  return (
    <Modal
      abierto
      titulo={soloAutorizar ? 'Autorizar el descuento' : 'Descuento manual'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" onClick={aceptar}>
            Aplicar
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        {!soloAutorizar && (
          <>
            <p className="text-sm text-neutral-500">{objetivo.nombre}</p>
            <div className="flex flex-wrap gap-2">
              {rapidos.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPct(String(p));
                    setError('');
                  }}
                  className={`min-h-10 px-4 rounded-xl text-sm font-semibold transition ${
                    Number(pct) === p
                      ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                      : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <Campo
              etiqueta="Porcentaje de descuento"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={max}
              value={pct}
              onChange={(e) => {
                setPct(e.target.value);
                setError('');
              }}
              ayuda={`Lo máximo que se puede descontar a mano es ${max}%.`}
            />
            <label className="flex items-center gap-3 min-h-11 cursor-pointer">
              <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-5 accent-[var(--c-primario)]" />
              <span className="text-sm">Aplicar el mismo descuento a todos los artículos</span>
            </label>
          </>
        )}

        <Campo
          etiqueta="Motivo *"
          value={motivo}
          maxLength={200}
          placeholder="¿Por qué se da el descuento?"
          onChange={(e) => {
            setMotivo(e.target.value);
            setError('');
          }}
        />
        {!puedeAutorizar && (
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
          etiqueta={puedeAutorizar ? 'Tu PIN *' : 'PIN del encargado *'}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(soloDigitos(e.target.value, 4));
            setError('');
          }}
          ayuda="Un gerente o administrador debe autorizar el descuento."
        />
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}