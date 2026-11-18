import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Segmentos from '../../shared/Segmentos.jsx';

const MAXIMO = 60;
const claseInput =
  'w-full min-h-11 px-3 rounded-xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20 disabled:bg-neutral-100 disabled:text-neutral-500';

// valor = [{ fecha: 'AAAA-MM-DD', cerrado, abre?, cierra?, nota }]
export default function EditorFechas({ valor, onCambio, disabled = false }) {
  const poner = (i, cambios) => onCambio(valor.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
  const quitar = (i) => onCambio(valor.filter((_, j) => j !== i));
  const agregar = () => onCambio([...valor, { fecha: '', cerrado: true, nota: '' }]);

  return (
    <div className="space-y-3">
      {valor.length === 0 && <p className="text-sm text-neutral-500">No hay días especiales.</p>}

      {valor.map((x, i) => (
        <div key={i} className="rounded-2xl border border-[var(--c-borde)] p-3 space-y-3">
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="block text-xs font-medium text-neutral-500 mb-1">Fecha</span>
              <input type="date" value={x.fecha} disabled={disabled} onChange={(e) => poner(i, { fecha: e.target.value })} className={claseInput} />
            </label>
            {!disabled && (
              <button type="button" aria-label="Quitar fecha" onClick={() => quitar(i)} className="size-11 shrink-0 rounded-xl bg-[#f3efe6] text-neutral-500">
                ✕
              </button>
            )}
          </div>

          <Segmentos
            compacto
            opciones={[
              { id: 'cerrado', nombre: 'Cerrado' },
              { id: 'distinto', nombre: 'Horario distinto' },
            ]}
            valor={x.cerrado ? 'cerrado' : 'distinto'}
            onCambio={(v) =>
              !disabled &&
              (v === 'cerrado' ? poner(i, { cerrado: true }) : poner(i, { cerrado: false, abre: x.abre ?? '09:00', cierra: x.cierra ?? '14:00' }))
            }
            className={disabled ? 'opacity-60 pointer-events-none' : ''}
          />

          {!x.cerrado && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-neutral-500 mb-1">Abre</span>
                <input type="time" value={x.abre ?? ''} disabled={disabled} onChange={(e) => poner(i, { abre: e.target.value })} className={claseInput} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-neutral-500 mb-1">Cierra</span>
                <input type="time" value={x.cierra ?? ''} disabled={disabled} onChange={(e) => poner(i, { cierra: e.target.value })} className={claseInput} />
              </label>
            </div>
          )}

          <Campo etiqueta="Nota (opcional)" value={x.nota ?? ''} maxLength={80} disabled={disabled} placeholder="Ejemplo: Navidad" onChange={(e) => poner(i, { nota: e.target.value })} />
        </div>
      ))}

      {!disabled && valor.length < MAXIMO && (
        <Boton compacto variante="secundario" onClick={agregar}>
          + Agregar una fecha
        </Boton>
      )}
    </div>
  );
}