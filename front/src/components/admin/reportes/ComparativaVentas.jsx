import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../../utils/formato.js';

const anio = (iso) => iso.slice(0, 4);

function rangoTexto(desde, hasta) {
  if (desde === hasta) return `${formatearFechaLarga(desde)} de ${anio(desde)}`;
  const inicio = anio(desde) === anio(hasta) ? formatearFechaLarga(desde) : `${formatearFechaLarga(desde)} de ${anio(desde)}`;
  return `${inicio} al ${formatearFechaLarga(hasta)} de ${anio(hasta)}`;
}

function Tendencia({ c, dinero }) {
  if (c.tendencia === 'sinBase') return <p className="mt-2 text-sm text-neutral-500">Entonces no hubo ventas con qué comparar.</p>;
  if (c.tendencia === 'igual') return <p className="mt-2 text-sm text-neutral-500">Vendes igual que entonces.</p>;
  const sube = c.tendencia === 'sube';
  return (
    <p className={`mt-2 text-sm font-semibold ${sube ? 'text-emerald-700' : 'text-red-700'}`}>
      {sube ? '▲' : '▼'} {Math.abs(c.porcentaje)}% {sube ? 'más' : 'menos'} · {dinero(Math.abs(c.diferencia))}
    </p>
  );
}

// futuro: el periodo aún no llega; solo se muestra cuánto se vendió en los parecidos
export default function ComparativaVentas({ actual, comparativa, futuro }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <section>
      <h3 className="font-semibold tracking-tight mb-1">{futuro ? 'Cómo se vendió en periodos parecidos' : 'Comparativa'}</h3>
      <p className="text-xs text-neutral-500 mb-3">
        {futuro ? 'Úsalo para calcular cuánto esperas vender.' : 'Lo vendido en este periodo contra el mismo periodo de antes.'}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!futuro && (
          <li className="rounded-3xl bg-white border-2 border-[var(--c-acento)] p-5">
            <p className="text-sm font-medium">Este periodo</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{dinero(actual.vendido)}</p>
            <p className="text-xs text-neutral-400">
              {actual.notas} {actual.notas === 1 ? 'nota o venta' : 'notas y ventas'}
            </p>
          </li>
        )}
        {comparativa.map((c) => (
          <li key={c.id} className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <p className="text-sm font-medium">{c.etiqueta}</p>
            <p className="text-xs text-neutral-400">{rangoTexto(c.desde, c.hasta)}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{dinero(c.vendido)}</p>
            <p className="text-xs text-neutral-400">
              {c.notas} {c.notas === 1 ? 'nota o venta' : 'notas y ventas'}
            </p>
            {!futuro && <Tendencia c={c} dinero={dinero} />}
          </li>
        ))}
      </ul>
    </section>
  );
}