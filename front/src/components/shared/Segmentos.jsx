// Selector de opciones en forma de píldoras (conmutador y pestañas). contador es opcional.
// compacto: más bajo, para ahorrar espacio en Caja.
export default function Segmentos({ opciones, valor, onCambio, compacto = false, className = '' }) {
  return (
    <div
      role="tablist"
      className={`flex w-fit max-w-full shrink-0 overflow-x-auto p-1 rounded-2xl bg-white border border-[var(--c-borde)] ${className}`}
    >
      {opciones.map(({ id, nombre, contador }) => {
        const activo = valor === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onCambio(id)}
            className={`${
              compacto ? 'min-h-9 px-3.5' : 'min-h-10 px-4 sm:px-5'
            } rounded-xl text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 ${
              activo
                ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {nombre}
            {contador > 0 && (
              <span className={`min-w-5 px-1.5 rounded-full text-xs leading-5 ${activo ? 'bg-white/25 text-white' : 'bg-[#f3efe6] text-neutral-600'}`}>
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}