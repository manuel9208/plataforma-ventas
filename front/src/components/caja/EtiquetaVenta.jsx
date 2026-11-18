const ESTILOS = {
  completa: { texto: 'Completa', clases: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  parcial: { texto: 'Devolución parcial', clases: 'bg-amber-50 text-amber-700 ring-amber-200' },
  devuelta: { texto: 'Devuelta', clases: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
};

export default function EtiquetaVenta({ estado }) {
  const e = ESTILOS[estado] ?? ESTILOS.completa;
  return <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${e.clases}`}>{e.texto}</span>;
}