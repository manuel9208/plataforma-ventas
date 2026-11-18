const VARIANTES = {
  primario:
    'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))] shadow-[0_8px_20px_-8px_rgba(29,43,79,0.7)] hover:brightness-110',
  secundario: 'bg-white text-[var(--c-texto)] border border-[var(--c-borde)] hover:bg-[#faf8f3]',
  peligro:
    'text-white bg-[linear-gradient(180deg,#ef4444,#b91c1c)] shadow-[0_8px_20px_-8px_rgba(185,28,28,0.6)] hover:brightness-110',
};

export default function Boton({
  variante = 'primario',
  compacto = false,
  cargando = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const tamano = compacto ? 'min-h-10 px-4 text-sm' : 'min-h-12 px-5 text-base';
  return (
    <button
      type={type}
      {...props}
      disabled={props.disabled || cargando}
      className={`${tamano} rounded-2xl font-semibold tracking-tight transition active:scale-[0.98] disabled:opacity-50 disabled:shadow-none ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  );
}