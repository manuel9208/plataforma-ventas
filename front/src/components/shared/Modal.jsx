import { useEffect } from 'react';

export default function Modal({ abierto, titulo, onCerrar, pie, ancho = 'sm:max-w-lg', children }) {
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0b1226]/55 backdrop-blur-md sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${ancho} max-h-[92dvh] flex flex-col bg-white rounded-t-[28px] sm:rounded-[28px] border border-[var(--c-borde)] shadow-[0_30px_80px_-20px_rgba(11,18,38,0.6)]`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--c-borde)]">
          <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="size-9 rounded-full bg-[#f3efe6] text-neutral-600 hover:bg-[#ebe5d8]"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {pie && (
          <div className="px-6 py-4 border-t border-[var(--c-borde)] flex gap-3 bg-[#fbfaf6] rounded-b-[28px]">{pie}</div>
        )}
      </div>
    </div>
  );
}