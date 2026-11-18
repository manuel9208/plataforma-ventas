import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';

export default function CatalogoServicios({ catalogo, onElegir }) {
  const { empresa } = useAuth();

  return (
    <>
      {catalogo.error && (
        <div className="mb-4">
          <MensajeError error={catalogo.error} />
        </div>
      )}

      {catalogo.cargando && catalogo.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-16">Cargando…</p>
      ) : catalogo.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-16">
          {catalogo.buscar ? `No encontramos "${catalogo.buscar}".` : 'No hay servicios en esta sucursal.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {catalogo.datos.map((s) => (
            <article key={s.id} className="rounded-2xl bg-white border border-[var(--c-borde)] p-3 shadow-sm flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-acento)] truncate">{s.departamento}</p>
              <h3 className="text-sm sm:text-base font-semibold tracking-tight leading-snug line-clamp-2">{s.nombre}</h3>
              {s.descripcion && <p className="hidden sm:block text-sm text-neutral-500 mt-0.5 line-clamp-2">{s.descripcion}</p>}
              {s.tiempoDias !== null && (
                <p className="text-xs text-neutral-400 mt-0.5">
                  {s.tiempoDias === 0 ? 'Entrega el mismo día' : `Entrega en ${s.tiempoDias} día${s.tiempoDias === 1 ? '' : 's'}`}
                </p>
              )}
              <div className="mt-auto pt-2 space-y-1.5">
                {s.precios.map((p) => (
                  <button
                    key={p.tipoArticuloId}
                    type="button"
                    aria-label={`Agregar ${s.nombre}, ${p.tipo}`}
                    onClick={() => onElegir(s, p)}
                    className="w-full min-h-11 pl-3 pr-2 rounded-xl border border-[var(--c-borde)] bg-[#faf8f3] flex items-center justify-between gap-2 text-left transition hover:border-[var(--c-acento)] active:scale-[0.97]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] leading-tight text-neutral-500 truncate">{p.tipo}</span>
                      <span className="block font-semibold leading-tight">{formatearMoneda(p.precio, empresa.moneda)}</span>
                    </span>
                    <span className="size-7 shrink-0 rounded-full grid place-items-center text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]">
                      <Icono nombre="mas" className="size-4" />
                    </span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {catalogo.hayMas && (
        <div className="flex justify-center mt-6">
          <Boton variante="secundario" cargando={catalogo.cargando} onClick={catalogo.verMas}>
            Ver más
          </Boton>
        </div>
      )}
    </>
  );
}