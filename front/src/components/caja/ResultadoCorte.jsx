import { useAuth } from '../../context/AuthContext.jsx';
import { RESULTADO_CORTE, textoDiferencia } from '../../utils/corte.js';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';

const Fila = ({ etiqueta, valor, fuerte = false }) => (
  <div className={`flex justify-between ${fuerte ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
    <span>{etiqueta}</span>
    <span>{valor}</span>
  </div>
);

// Lo que se muestra al terminar el corte. El cajero ciego solo ve lo que entrega.
export default function ResultadoCorte({ cierre }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const c = cierre.corte;

  return (
    <div className="mb-4 max-w-2xl space-y-3">
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Corte registrado</p>

        {c?.vista === 'ciega' && (
          <div className="mt-3">
            <p className="text-sm text-neutral-500">Entrega a los dueños</p>
            <p className="text-4xl font-semibold tracking-tight">{dinero(c.entregar)}</p>
          </div>
        )}

        {c?.vista === 'detallada' && (
          <div className="mt-3 space-y-3">
            {c.sinConteo ? (
              <p className="text-neutral-600">El turno se cerró sin conteo de efectivo.</p>
            ) : (
              <>
                <p className={`rounded-2xl border px-4 py-3 font-semibold ${RESULTADO_CORTE[c.resultado].clases}`}>
                  {textoDiferencia(c.resultado, c.diferencia, dinero)}
                </p>
                <div className="space-y-1 text-sm">
                  <Fila etiqueta="Debe haber" valor={dinero(c.esperado)} />
                  <Fila etiqueta="Contado" valor={dinero(c.contado)} />
                  <Fila etiqueta="Dejado para mañana" valor={dinero(c.dejado)} />
                  <Fila etiqueta="A entregar" valor={dinero(c.entregado)} fuerte />
                </div>
              </>
            )}
          </div>
        )}

        {!c && <p className="mt-2 text-neutral-600">Turno cerrado.</p>}
      </div>

      {cierre.cierreTardio && (
        <p className="text-sm rounded-xl px-3 py-3 border text-amber-800 bg-amber-50 border-amber-200">
          Turno cerrado con la fecha del {formatearFechaLarga(cierre.fechaOperativa)}. Advertencia: no se cerró ese día, se cerró el{' '}
          {formatearFechaLarga(cierre.cierreFecha)}.
        </p>
      )}
    </div>
  );
}