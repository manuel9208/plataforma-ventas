import { formatearTelefono } from '../../utils/formato.js';
import Icono from '../shared/Icono.jsx';

// cliente: { envio, vista } o null · onAbrir abre la ventana para buscarlo o cambiarlo
export default function BarraCliente({ cliente, onAbrir }) {
  const v = cliente?.vista;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="mb-3 w-full min-h-14 px-4 rounded-2xl bg-white border border-[var(--c-borde)] flex items-center gap-3 text-left transition hover:border-[var(--c-acento)]"
    >
      {v ? (
        <>
          <span className="size-10 shrink-0 rounded-full grid place-items-center text-white font-semibold bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]">
            {v.nombre.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold truncate">{v.nombre}</span>
            <span className="block text-xs text-neutral-500">{formatearTelefono(v.telefono)}</span>
          </span>
          <span className="text-sm font-medium text-[var(--c-primario)]">Cambiar</span>
        </>
      ) : (
        <>
          <span className="text-neutral-400">
            <Icono nombre="buscar" className="size-5" />
          </span>
          <span className="flex-1 text-neutral-500">Buscar cliente por nombre o teléfono</span>
          <span className="text-sm font-medium text-[var(--c-primario)]">Elegir</span>
        </>
      )}
    </button>
  );
}