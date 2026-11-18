// Interruptor estilo iOS con título y explicación
export default function Interruptor({ etiqueta, descripcion, valor, onCambiar, disabled = false }) {
  return (
    <label className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-neutral-200/70 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-sm text-neutral-500 mt-0.5">{descripcion}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={valor}
        disabled={disabled}
        onChange={(e) => onCambiar(e.target.checked)}
        className="sr-only peer"
      />
      <span className="relative shrink-0 mt-0.5 w-12 h-7 rounded-full bg-neutral-300 transition peer-checked:bg-[var(--c-primario)] peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--c-primario)]/20 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}