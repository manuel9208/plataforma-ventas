import MensajeError from '../../shared/MensajeError.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import ComparativaVentas from './ComparativaVentas.jsx';
import MetaVentas from './MetaVentas.jsx';
import GraficaHoras from './GraficaHoras.jsx';
import { useEstadisticasVentas } from './useEstadisticasVentas.js';

// consulta: los filtros del reporte · hoy: el día de hoy en la sucursal · hastaHoy / onHastaHoy: comparar solo los mismos días
export default function EstadisticasVentas({ consulta, hoy, hastaHoy, onHastaHoy }) {
  const { datos, error, cargando } = useEstadisticasVentas(consulta);
  if (!consulta) return null;

  const futuro = Boolean(hoy) && consulta.desde > hoy;

  return (
    <section className="space-y-5 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Estadísticas</h2>
        <p className="text-sm text-neutral-500">
          {futuro ? 'Ese periodo todavía no llega: así se vendió en periodos parecidos.' : 'Cómo vas frente a otros periodos.'}
        </p>
      </div>

      {datos?.enCurso && !futuro && (
        <div className="max-w-xl rounded-2xl bg-white border border-[var(--c-borde)] p-4">
          <Interruptor
            etiqueta="Comparar hasta el mismo día"
            descripcion="Este periodo aún no termina. Encendido, se compara solo con los mismos días de antes y no con el periodo completo."
            valor={hastaHoy}
            onCambiar={onHastaHoy}
          />
        </div>
      )}
      {datos?.recortado && !futuro && <p className="text-xs text-neutral-500">Las comparaciones usan solo los mismos días que llevas de este periodo.</p>}

      {error && (
        <div className="max-w-xl">
          <MensajeError error={error} />
        </div>
      )}
      {!datos && cargando && <p className="text-neutral-400">Calculando…</p>}

      {datos && (
        <div className={`space-y-5 transition ${cargando ? 'opacity-60' : ''}`}>
          <ComparativaVentas actual={datos.actual} comparativa={datos.comparativa} futuro={futuro} />
          <MetaVentas meta={datos.meta} futuro={futuro} />
          <GraficaHoras horas={datos.horas} futuro={futuro} />
        </div>
      )}
    </section>
  );
}