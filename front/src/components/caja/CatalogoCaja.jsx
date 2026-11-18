import { useState } from 'react';
import { permiteDecimales } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import ModalCantidad from './ModalCantidad.jsx';

export default function CatalogoCaja({ catalogo, onAgregar }) {
  const { empresa } = useAuth();
  const [pidiendo, setPidiendo] = useState(null); // { producto, presentacion } cuando es granel

  // Piezas, cajas y cartones se agregan de un toque; lo que se pesa o mide pide cantidad
  const tocar = (producto, presentacion) => {
    if (permiteDecimales(presentacion.unidad)) setPidiendo({ producto, presentacion });
    else onAgregar(producto, presentacion, 1);
  };

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
          {catalogo.buscar ? `No encontramos "${catalogo.buscar}".` : 'No hay productos en esta sucursal.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {catalogo.datos.map((p) => (
            <article key={p.id} className="rounded-2xl bg-white border border-[var(--c-borde)] p-3 shadow-sm flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-acento)] truncate">{p.departamento}</p>
              <h3 className="text-sm sm:text-base font-semibold tracking-tight leading-snug line-clamp-2">{p.nombre}</h3>
              {p.marca && <p className="text-xs text-neutral-500 truncate">{p.marca}</p>}
              <div className="mt-auto pt-2 space-y-1.5">
                {p.presentaciones.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    aria-label={`Agregar ${p.nombre}, ${pr.nombre}`}
                    onClick={() => tocar(p, pr)}
                    className="w-full min-h-11 pl-3 pr-2 rounded-xl border border-[var(--c-borde)] bg-[#faf8f3] flex items-center justify-between gap-2 text-left transition hover:border-[var(--c-acento)] active:scale-[0.97]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] leading-tight text-neutral-500 truncate">{pr.nombre}</span>
                      <span className="block font-semibold leading-tight">{formatearMoneda(pr.precio, empresa.moneda)}</span>
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

      {pidiendo && (
        <ModalCantidad
          producto={pidiendo.producto}
          presentacion={pidiendo.presentacion}
          onAceptar={(cantidad) => {
            onAgregar(pidiendo.producto, pidiendo.presentacion, cantidad);
            setPidiendo(null);
          }}
          onCerrar={() => setPidiendo(null)}
        />
      )}
    </>
  );
}