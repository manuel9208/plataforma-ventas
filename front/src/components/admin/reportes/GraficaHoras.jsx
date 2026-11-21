import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';

const COLORES = ['#1d2b4f', '#c9a25c', '#8b95ad', '#cbd2e1'];
const hora = (h) => (h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 p. m.' : `${h - 12} p. m.`);

// Barras por hora, sin librerías. En un periodo largo suma todas las horas iguales de todos los días.
export default function GraficaHoras({ horas, futuro }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { series, filas, pico, horarioConfigurado } = horas;
  if (!filas.length) return null;

  const max = Math.max(1, ...filas.flatMap((f) => Object.values(f.valores)));
  const sinVentas = futuro ? [] : filas.filter((f) => f.sinVentas);

  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
      <h3 className="font-semibold tracking-tight">Ventas por hora</h3>
      <p className="text-xs text-neutral-500 mt-0.5">
        {horarioConfigurado
          ? 'Según el horario de tu sucursal.'
          : 'Usé el horario de 9 a. m. a 9 p. m. porque aún no configuras el tuyo (Configuración → Horario).'}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORES[i] ?? COLORES[3] }} />
            {s.id === 'actual' ? (futuro ? 'Este periodo (aún sin ventas)' : 'Este periodo') : s.etiqueta}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {filas.map((f) => {
            const detalle = series.map((s) => `${s.etiqueta}: ${dinero(f.valores[s.id])}`).join(' · ');
            return (
              <div
                key={f.hora}
                title={`${hora(f.hora)} · ${detalle}${f.sinVentas && !futuro ? ' · Sin ventas' : ''}`}
                className={`w-14 shrink-0 rounded-xl px-1 pt-2 pb-1 ${f.sinVentas && !futuro ? 'bg-amber-50' : ''}`}
              >
                <div className="h-40 flex items-end justify-center gap-0.5">
                  {series.map((s, i) => {
                    const v = f.valores[s.id];
                    return v > 0 ? (
                      <div
                        key={s.id}
                        className="w-2.5 rounded-t"
                        style={{ height: `${Math.max(Math.round((v / max) * 100), 3)}%`, backgroundColor: COLORES[i] ?? COLORES[3] }}
                      />
                    ) : (
                      <div key={s.id} className="w-2.5 h-px" style={{ backgroundColor: COLORES[i] ?? COLORES[3], opacity: 0.4 }} />
                    );
                  })}
                </div>
                <p className={`mt-1 text-center text-[10px] leading-tight ${f.abierta ? 'text-neutral-600' : 'text-neutral-300'}`}>{hora(f.hora)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        {pico !== null && !futuro && <p className="text-neutral-700">Hora con más ventas: <span className="font-semibold">{hora(pico)}</span></p>}
        {sinVentas.length > 0 && (
          <p className="text-amber-800">
            Horas abiertas sin ventas: <span className="font-semibold">{sinVentas.map((f) => hora(f.hora)).join(', ')}</span>
          </p>
        )}
        {!futuro && sinVentas.length === 0 && pico !== null && <p className="text-emerald-700">Hubo ventas en todas las horas abiertas.</p>}
      </div>
    </section>
  );
}