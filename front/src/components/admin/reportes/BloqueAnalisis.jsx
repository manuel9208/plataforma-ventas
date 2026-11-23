// Piezas que comparten todos los bloques del análisis

export default function BloqueAnalisis({ titulo, nota, children }) {
  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
      <h3 className="font-semibold tracking-tight">{titulo}</h3>
      {nota && <p className="text-xs text-neutral-500 mt-0.5">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// El color va en el estilo para que la barra siempre se vea
export function Barra({ porcentaje, color = '#c9a25c' }) {
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-[#f3efe6] overflow-hidden" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(porcentaje, 0), 100)}%`, backgroundColor: color }} />
    </div>
  );
}

export function Vacio({ children }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

export function Tarjeta({ titulo, valor, nota, clase = '' }) {
  return (
    <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
      <p className="text-sm text-neutral-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${clase}`}>{valor}</p>
      {nota && <p className="mt-1.5 text-xs text-neutral-400">{nota}</p>}
    </div>
  );
}