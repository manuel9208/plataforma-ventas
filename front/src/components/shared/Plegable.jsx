import { useState } from 'react';

// Sección que se abre y se cierra. "abiertaInicial" solo se lee la primera vez.
export default function Plegable({ titulo, abiertaInicial = false, children }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <div className="rounded-2xl border border-neutral-200">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta(!abierta)}
        className="w-full min-h-12 px-4 flex items-center justify-between text-left font-medium"
      >
        {titulo}
        <span className={`text-xl text-neutral-400 transition ${abierta ? 'rotate-90' : ''}`}>›</span>
      </button>
      {abierta && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}