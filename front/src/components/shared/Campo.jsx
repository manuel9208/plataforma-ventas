export default function Campo({ etiqueta, ayuda, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-neutral-600 mb-1.5">{etiqueta}</span>
      <input
        {...props}
        className="w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] text-base text-[var(--c-texto)] placeholder:text-neutral-400 outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20 disabled:bg-neutral-100 disabled:text-neutral-500"
      />
      {ayuda && <span className="block text-xs text-neutral-500 mt-1">{ayuda}</span>}
    </label>
  );
}