import { formatearTelefono } from '../../utils/formato.js';
import Icono from '../shared/Icono.jsx';

// cliente: { envio, vista } o null · onAbrir busca o cambia al cliente · onCompletar abre sus datos y su PIN
export default function BarraCliente({ cliente, onAbrir, onCompletar }) {
  const v = cliente?.vista;
  const falta = v?.perfil && !v.perfil.completo ? v.perfil.falta : null;

  return (
    <div className="mb-3 rounded-2xl bg-white border border-[var(--c-borde)] transition hover:border-[var(--c-acento)]">
      <button type="button" onClick={onAbrir} className="w-full min-h-14 px-4 flex items-center gap-3 text-left">
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

      {v && (
        <div className="px-4 pb-3 flex items-center justify-between gap-3">
          {!v.id ? (
            <p className="text-xs text-neutral-500">Cliente nuevo: se registra al cobrar y sus datos se completan después.</p>
          ) : falta ? (
            <>
              <p className="text-xs text-amber-700">Falta: {falta.join(', ')}</p>
              <button type="button" onClick={onCompletar} className="text-sm font-medium text-[var(--c-primario)] shrink-0">
                Completar
              </button>
            </>
          ) : (
            <p className="text-xs text-emerald-700">Perfil completo</p>
          )}
        </div>
      )}
    </div>
  );
}