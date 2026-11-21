import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';

export default function MetaVentas({ meta, futuro }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const avance = Math.min(meta.avance ?? 0, 100);

  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
      <h3 className="font-semibold tracking-tight">{futuro ? 'Meta para ese periodo' : 'Meta de venta'}</h3>

      {meta.sinBase ? (
        <p className="mt-2 text-sm text-neutral-500">
          Todavía no hay meta: en «{meta.contra.toLowerCase()}» no se vendió nada, así que no hay con qué calcularla.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-500">
            {meta.contra}: {dinero(meta.base)}
            {meta.porcentaje !== null ? ` + ${meta.porcentaje}%` : ' + el crecimiento de cada sucursal'} = {dinero(meta.meta)}. Se cambia en Configuración → Metas de venta.
          </p>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="text-3xl font-semibold tracking-tight">{dinero(meta.meta)}</p>
            <p className="text-sm text-neutral-500">Llevas {dinero(meta.vendido)}</p>
          </div>
          <div className="mt-3 h-3 rounded-full overflow-hidden bg-[#f3efe6]" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${avance}%`, backgroundColor: meta.cumplida ? '#059669' : '#1d2b4f' }} />
          </div>
          <p className={`mt-2 text-sm font-medium ${meta.cumplida ? 'text-emerald-700' : 'text-neutral-600'}`}>
            {meta.cumplida ? '¡Meta cumplida!' : futuro ? 'Aún no empieza' : `Avance ${meta.avance ?? 0}% · faltan ${dinero(meta.falta)}`}
          </p>
        </>
      )}
    </section>
  );
}