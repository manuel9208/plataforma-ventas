import { formatearMoneda } from '../../utils/formato.js';

export default function TarjetaCatalogo({ item, moneda }) {
  return (
    <article className="flex flex-col rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_1px_2px_rgba(22,29,51,0.04),0_14px_30px_-18px_rgba(22,29,51,0.25)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c-acento)]">{item.departamento}</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">{item.nombre}</h3>
      {item.marca && <p className="text-sm text-neutral-500">{item.marca}</p>}
      {item.descripcion && <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{item.descripcion}</p>}

      <ul className="mt-4 divide-y divide-[var(--c-borde)] text-sm">
        {item.precios.map((p) => (
          <li key={p.nombre} className="flex items-center justify-between gap-3 py-2">
            <span className="text-neutral-600">{p.nombre}</span>
            <span className="font-semibold">{formatearMoneda(p.precio, moneda)}</span>
          </li>
        ))}
      </ul>

      {item.entregaDias !== null && (
        <p className="mt-3 text-xs text-neutral-400">
          {item.entregaDias === 0 ? 'Entrega el mismo día' : `Entrega en ${item.entregaDias} día${item.entregaDias === 1 ? '' : 's'}`}
        </p>
      )}
    </article>
  );
}