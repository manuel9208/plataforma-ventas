import { ESTADOS_REPORTE, GIROS_REPORTE, NOMBRES_MES_CUMPLE } from '@plataforma/calculos';
import { formatearFechaLarga } from '../../../utils/formato.js';
import Campo from '../../shared/Campo.jsx';
import Icono from '../../shared/Icono.jsx';
import Segmentos from '../../shared/Segmentos.jsx';

const PERIODOS = [
  { id: 'dia', nombre: 'Día' },
  { id: 'semana', nombre: 'Semana' },
  { id: 'mes', nombre: 'Mes' },
  { id: 'anio', nombre: 'Año' },
  { id: 'rango', nombre: 'Rango' },
];

const SELECT =
  'w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';
const FLECHA =
  'size-11 shrink-0 grid place-items-center rounded-xl bg-white border border-[var(--c-borde)] text-neutral-600 hover:border-[var(--c-acento)]';

const conAnio = (iso) => `${formatearFechaLarga(iso)} de ${iso.slice(0, 4)}`;

function nombrePeriodo(tipo, { desde, hasta }) {
  if (tipo === 'dia') return conAnio(desde);
  if (tipo === 'semana') return `Semana del ${conAnio(desde)} al ${conAnio(hasta)}`;
  if (tipo === 'mes') {
    const m = NOMBRES_MES_CUMPLE[Number(desde.slice(5, 7)) - 1];
    return `${m[0].toUpperCase()}${m.slice(1)} de ${desde.slice(0, 4)}`;
  }
  return `Año ${desde.slice(0, 4)}`;
}

const Chip = ({ activo, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    className={`min-h-10 px-4 rounded-full text-sm font-medium transition ${
      activo ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-[var(--c-borde)] text-neutral-600 hover:border-[var(--c-acento)]'
    }`}
  >
    {children}
  </button>
);

const Selector = ({ etiqueta, valor, onCambio, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-neutral-600 mb-1.5">{etiqueta}</span>
    <select value={valor} onChange={(e) => onCambio(e.target.value)} className={SELECT}>
      {children}
    </select>
  </label>
);

// r: lo que devuelve useReporteVentas
export default function FiltrosReporte({ r, esLimpieza }) {
  const { f, opciones } = r;
  const sucursales = opciones.sucursales;

  return (
    <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-4 sm:p-5 space-y-4">
      <Segmentos opciones={PERIODOS} valor={f.tipo} onCambio={r.cambiarTipo} />

      <div className="flex flex-wrap items-end gap-3">
        {f.tipo !== 'rango' ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Periodo anterior" onClick={() => r.mover(-1)} className={FLECHA}>
                <Icono nombre="atras" className="size-5" />
              </button>
              <button type="button" aria-label="Periodo siguiente" onClick={() => r.mover(1)} className={FLECHA}>
                <Icono nombre="atras" className="size-5 rotate-180" />
              </button>
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-xs text-neutral-500">Periodo</p>
              <p className="font-semibold tracking-tight">{r.rango ? nombrePeriodo(f.tipo, r.rango) : ''}</p>
            </div>
            <div className="w-full sm:w-48">
              <Campo etiqueta="Ir a la fecha" type="date" value={f.base} onChange={(e) => e.target.value && r.cambiar({ base: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <div className="w-full sm:w-48">
              <Campo
                etiqueta="Desde"
                type="date"
                value={f.personalizado.desde}
                max={f.personalizado.hasta || undefined}
                onChange={(e) => r.cambiarRango({ desde: e.target.value })}
              />
            </div>
            <div className="w-full sm:w-48">
              <Campo
                etiqueta="Hasta"
                type="date"
                value={f.personalizado.hasta}
                min={f.personalizado.desde || undefined}
                onChange={(e) => r.cambiarRango({ hasta: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      {sucursales.length > 1 && (
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">Sucursales</p>
          <div className="flex flex-wrap gap-2">
            <Chip activo={f.sucursales === null} onClick={r.verTodasLasSucursales}>
              Todas
            </Chip>
            {sucursales.map((s) => (
              <Chip key={s.id} activo={f.sucursales !== null && f.sucursales.includes(s.id)} onClick={() => r.alternarSucursal(s.id)}>
                {s.nombre}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Selector etiqueta="Empleado" valor={f.empleadoId} onCambio={(v) => r.cambiar({ empleadoId: v })}>
          <option value="">Todos</option>
          {opciones.empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
              {e.activo ? '' : ' (de baja)'}
            </option>
          ))}
        </Selector>
        {esLimpieza && (
          <>
            <Selector etiqueta="Tipo de nota" valor={f.estado} onCambio={(v) => r.cambiar({ estado: v })}>
              {ESTADOS_REPORTE.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.etiqueta}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="Qué se vendió" valor={f.giro} onCambio={(v) => r.cambiar({ giro: v })}>
              {GIROS_REPORTE.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.etiqueta}
                </option>
              ))}
            </Selector>
          </>
        )}
      </div>
    </div>
  );
}