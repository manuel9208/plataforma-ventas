export default function Insignia({ activo, textoActivo = 'Activo', textoInactivo = 'Inactivo' }) {
  return (
    <span
      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${
        activo ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-neutral-100 text-neutral-500 ring-neutral-200'
      }`}
    >
      {activo ? textoActivo : textoInactivo}
    </span>
  );
}