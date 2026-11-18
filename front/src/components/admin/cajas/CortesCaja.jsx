import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { RESULTADO_CORTE, textoDiferencia } from '../../../utils/corte.js';
import { formatearFechaLarga, formatearHora, formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import DetalleCorte from './DetalleCorte.jsx';
import { useCortes } from './useCortes.js';

const RESULTADOS = [
  { id: '', nombre: 'Todos' },
  { id: 'falta', nombre: 'Faltan' },
  { id: 'sobra', nombre: 'Sobran' },
  { id: 'cuadra', nombre: 'Cuadran' },
  { id: 'sin_conteo', nombre: 'Sin conteo' },
];

export default function CortesCaja() {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const c = useCortes();
  const [abierto, setAbierto] = useState(null);

  if (abierto) return <DetalleCorte turnoId={abierto} onVolver={() => setAbierto(null)} />;

  const hayFiltros = Object.values(c.filtros).some(Boolean);

  return (
    <section>
      {c.resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
            <p className="text-sm text-neutral-500">Cortes</p>
            <p className="text-2xl font-semibold tracking-tight">{c.total}</p>
          </div>
          <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
            <p className="text-sm text-neutral-500">Faltante total</p>
            <p className={`text-2xl font-semibold tracking-tight ${c.resumen.faltante < 0 ? 'text-red-700' : ''}`}>
              {dinero(Math.abs(c.resumen.faltante))}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
            <p className="text-sm text-neutral-500">Sobrante total</p>
            <p className={`text-2xl font-semibold tracking-tight ${c.resumen.sobrante > 0 ? 'text-amber-700' : ''}`}>{dinero(c.resumen.sobrante)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-[var(--c-borde)] p-4">
            <p className="text-sm text-neutral-500">Sin conteo</p>
            <p className="text-2xl font-semibold tracking-tight">{c.resumen.sinConteo}</p>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-4 sm:p-5 mb-5 space-y-4">
        <Segmentos opciones={RESULTADOS} valor={c.filtros.resultado} onCambio={(resultado) => c.cambiarFiltros({ resultado })} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {c.sucursales.length > 1 && (
            <label className="block">
              <span className="block text-sm font-medium text-neutral-600 mb-1.5">Sucursal</span>
              <select
                value={c.filtros.sucursalId}
                onChange={(e) => c.cambiarFiltros({ sucursalId: e.target.value })}
                className="w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
              >
                <option value="">Todas</option>
                {c.sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Campo etiqueta="Desde" type="date" value={c.filtros.desde} max={c.filtros.hasta || undefined} onChange={(e) => c.cambiarFiltros({ desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" value={c.filtros.hasta} min={c.filtros.desde || undefined} onChange={(e) => c.cambiarFiltros({ hasta: e.target.value })} />
          {hayFiltros && (
            <Boton variante="secundario" onClick={c.limpiarFiltros}>
              Quitar filtros
            </Boton>
          )}
        </div>
      </div>

      {c.error && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={c.error} />
        </div>
      )}

      {c.cargando && !c.datos.length ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : !c.datos.length ? (
        !c.error && (
          <p className="text-neutral-500">
            {hayFiltros ? 'No hay cortes con esos filtros.' : 'Aún no hay cortes. Aparecen cuando se cierra un turno.'}
          </p>
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {c.datos.map((k) => {
            const r = RESULTADO_CORTE[k.resultado];
            return (
              <li key={k.turnoId}>
                <button
                  type="button"
                  onClick={() => setAbierto(k.turnoId)}
                  className="w-full text-left rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] transition hover:bg-[#fbfaf6]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tracking-tight">{formatearFechaLarga(k.fechaOperativa)}</p>
                      <p className="text-sm text-neutral-600 truncate">
                        {k.caja} · {k.sucursal}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {k.cajero} · cerró {formatearHora(k.cerradoEn, k.zonaHoraria)}
                        {k.cierreTardio ? ' · cierre tardío' : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${r.clases}`}>{r.titulo}</span>
                  </div>
                  <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${r.clases}`}>{textoDiferencia(k.resultado, k.diferencia, dinero)}</p>
                  {!k.sinConteo && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Debía haber {dinero(k.esperado)} · contó {dinero(k.contado)} · entregó {dinero(k.entregado)}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {c.hayMas && (
        <div className="mt-6 flex justify-center">
          <Boton variante="secundario" cargando={c.cargandoMas} onClick={c.verMas}>
            Ver más
          </Boton>
        </div>
      )}
    </section>
  );
}