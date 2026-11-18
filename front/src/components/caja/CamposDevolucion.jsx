import { FORMAS_PAGO } from '@plataforma/calculos';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import Campo from '../shared/Campo.jsx';

// Forma de devolución, referencia opcional y motivo (siempre obligatorio)
export default function CamposDevolucion({ forma, onForma, referencia, onReferencia, motivo, onMotivo, conDinero = true }) {
  return (
    <>
      {conDinero && (
        <>
          <div>
            <p className="text-sm font-medium text-neutral-600 mb-2">¿Cómo se devuelve el dinero?</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_PAGO.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onForma(f)}
                  className={`min-h-11 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    forma === f
                      ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                      : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                  }`}
                >
                  {ETIQUETA_FORMA[f]}
                </button>
              ))}
            </div>
            {forma !== 'efectivo' && (
              <p className="text-xs text-neutral-500 mt-2">
                Solo se registra. El dinero lo regresas tú desde la terminal o el banco.
              </p>
            )}
          </div>
          {forma !== 'efectivo' && (
            <Campo
              etiqueta="Referencia (opcional)"
              value={referencia}
              onChange={(e) => onReferencia(e.target.value)}
              maxLength={60}
              ayuda="Número de operación o folio, si lo tienes."
            />
          )}
        </>
      )}
      <Campo
        etiqueta="Motivo *"
        value={motivo}
        onChange={(e) => onMotivo(e.target.value)}
        maxLength={200}
        placeholder="¿Por qué se hace?"
      />
    </>
  );
}