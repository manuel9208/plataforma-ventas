import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import BloqueAnalisis, { Barra, Vacio } from './BloqueAnalisis.jsx';

export function PorEmpleado({ empleados }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <BloqueAnalisis titulo="Por empleado" nota="Quién levantó cada nota o venta. El ticket promedio es lo vendido entre sus notas vigentes.">
      {empleados.length === 0 ? (
        <Vacio>Nadie vendió en este periodo.</Vacio>
      ) : (
        <ul className="divide-y divide-[var(--c-borde)]">
          {empleados.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.nombre}</p>
                  <p className="text-xs text-neutral-500">
                    {e.notas} {e.notas === 1 ? 'nota o venta' : 'notas y ventas'} · ticket promedio {dinero(e.ticketPromedio)}
                    {e.canceladas > 0 ? ` · ${e.canceladas} cancelada${e.canceladas === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{dinero(e.vendido)}</p>
                  <p className="text-xs text-neutral-500">{e.porcentaje}% del total</p>
                </div>
              </div>
              <Barra porcentaje={e.porcentaje} />
            </li>
          ))}
        </ul>
      )}
    </BloqueAnalisis>
  );
}

export function PorDiaSemana({ diasSemana }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { dias, mejor } = diasSemana;
  const max = Math.max(...dias.map((d) => d.promedio), 0);
  const hayVentas = dias.some((d) => d.notas > 0);

  return (
    <BloqueAnalisis titulo="Por día de la semana" nota="Lo que se vende en promedio cada día. Un periodo que sigue en curso solo cuenta los días que ya pasaron.">
      {!hayVentas ? (
        <Vacio>No hubo ventas en este periodo.</Vacio>
      ) : (
        <ul className="space-y-3">
          {dias.map((d) => (
            <li key={d.dia}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <p className="font-medium">
                  {d.nombre}
                  {d.dia === mejor && (
                    <span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5">Mejor día</span>
                  )}
                </p>
                <p className="text-neutral-600 text-right">
                  {d.veces === 0 ? 'No hubo este día' : `${dinero(d.promedio)} por día`}
                </p>
              </div>
              <Barra porcentaje={max > 0 ? (d.promedio / max) * 100 : 0} color={d.dia === mejor ? '#059669' : '#1d2b4f'} />
              {d.veces > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  {d.veces} {d.veces === 1 ? 'día' : 'días'} · {d.notas} {d.notas === 1 ? 'nota o venta' : 'notas y ventas'} · {dinero(d.vendido)} en total
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </BloqueAnalisis>
  );
}