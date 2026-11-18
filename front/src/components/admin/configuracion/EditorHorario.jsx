import { DIAS, textoHorario } from '@plataforma/calculos';
import Boton from '../../shared/Boton.jsx';

const claseHora =
  'w-full min-h-11 px-3 rounded-xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20 disabled:bg-neutral-100 disabled:text-neutral-500';

function Hora({ etiqueta, value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-500 mb-1">{etiqueta}</span>
      <input type="time" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={claseHora} />
    </label>
  );
}

// valor = { lun: { abierto, abre, cierra, descanso }, mar: ... }
export default function EditorHorario({ valor, onCambio, disabled = false }) {
  const poner = (id, cambios) => onCambio({ ...valor, [id]: { ...valor[id], ...cambios } });
  const abrir = (id) => poner(id, { abierto: true, abre: valor[id].abre ?? '09:00', cierra: valor[id].cierra ?? '19:00', descanso: valor[id].descanso ?? null });
  const cerrar = (id) => onCambio({ ...valor, [id]: { abierto: false } });
  const copiarLunes = () => onCambio(Object.fromEntries(DIAS.map((d) => [d.id, { ...valor.lun }])));

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {DIAS.map((d) => {
          const dia = valor[d.id] ?? { abierto: false };
          return (
            <li key={d.id} className="rounded-2xl border border-[var(--c-borde)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{d.nombre}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dia.abierto}
                  disabled={disabled}
                  onClick={() => (dia.abierto ? cerrar(d.id) : abrir(d.id))}
                  className={`min-h-10 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                    dia.abierto ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]' : 'bg-[#f3efe6] text-neutral-500'
                  }`}
                >
                  {dia.abierto ? 'Abierto' : 'Cerrado'}
                </button>
              </div>

              {dia.abierto && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Hora etiqueta="Abre" value={dia.abre} disabled={disabled} onChange={(v) => poner(d.id, { abre: v })} />
                    <Hora etiqueta="Cierra" value={dia.cierra} disabled={disabled} onChange={(v) => poner(d.id, { cierra: v })} />
                  </div>
                  {dia.descanso ? (
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <Hora etiqueta="Descanso de" value={dia.descanso.de} disabled={disabled} onChange={(v) => poner(d.id, { descanso: { ...dia.descanso, de: v } })} />
                      <Hora etiqueta="a" value={dia.descanso.a} disabled={disabled} onChange={(v) => poner(d.id, { descanso: { ...dia.descanso, a: v } })} />
                      {!disabled && (
                        <button type="button" onClick={() => poner(d.id, { descanso: null })} className="col-span-2 text-left min-h-9 text-xs font-medium text-[var(--c-primario-2)] underline underline-offset-4">
                          Quitar descanso
                        </button>
                      )}
                    </div>
                  ) : (
                    !disabled && (
                      <button type="button" onClick={() => poner(d.id, { descanso: { de: '14:00', a: '15:00' } })} className="min-h-9 text-xs font-medium text-[var(--c-primario-2)] underline underline-offset-4">
                        Agregar descanso (por ejemplo, la comida)
                      </button>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!disabled && (
        <Boton compacto variante="secundario" onClick={copiarLunes}>
          Copiar el lunes a todos los días
        </Boton>
      )}

      <div className="rounded-xl bg-[#faf8f3] border border-[var(--c-borde)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-1">Así lo verá tu cliente</p>
        {textoHorario(valor).map((l) => (
          <p key={l} className="text-sm text-neutral-600">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}