import { permiteDecimales } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';

// descuento: { disponible } · onDescuento({ clave, nombre }) abre el descuento manual; { clave: null } solo pide la autorización
function BotonDescuento({ pct, onAbrir, onQuitar }) {
  return pct ? (
    <span className="inline-flex items-center gap-1 pl-3 pr-1 min-h-9 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold">
      Descuento manual −{pct}%
      <button type="button" aria-label="Quitar descuento" onClick={onQuitar} className="size-7 rounded-md hover:bg-white">
        ✕
      </button>
    </span>
  ) : (
    <button type="button" onClick={onAbrir} className="min-h-9 px-3 rounded-lg border border-[var(--c-borde)] text-sm">
      Descuento
    </button>
  );
}

export default function Carrito({ carrito, incluyeIva, descuento, onCobrar, onVaciar, onEditarArticulo, onDescuento }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { lineas, notas, totales } = carrito;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold tracking-tight">{carrito.tieneServicios ? 'Nota actual' : 'Venta actual'}</h2>
        {!carrito.vacio && (
          <button type="button" onClick={onVaciar} className="text-sm text-neutral-500 hover:text-red-600">
            Vaciar
          </button>
        )}
      </div>

      {carrito.vacio ? (
        <p className="flex-1 grid place-items-center text-center text-neutral-400 py-10">
          Escanea un producto o toca uno del catálogo.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-3 pr-1">
          {notas.map((n) => {
            const datos = Object.values(n.articulo).filter(Boolean).join(' · ');
            return (
              <li key={n.clave} className="rounded-2xl border border-[var(--c-borde)] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {n.servicio.nombre} · {n.precio.tipo}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">{datos}</p>
                    <p className="text-xs text-neutral-400">Entrega: {formatearFechaLarga(n.fechaMostrada)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Quitar"
                    onClick={() => carrito.quitarArticulo(n.clave)}
                    className="size-8 shrink-0 rounded-full bg-[#f3efe6] text-neutral-500"
                  >
                    ✕
                  </button>
                </div>

                {n.extras.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
                    {n.extras.map((x) => (
                      <li key={x.id} className="flex justify-between">
                        <span>+ {x.nombre}</span>
                        <span>{dinero(x.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {n.promocion && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {n.promocion} · −{dinero(n.descuento)}
                  </p>
                )}

                <div className="flex items-end justify-between gap-3 mt-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEditarArticulo(n)}
                      className="min-h-9 px-3 rounded-lg border border-[var(--c-borde)] text-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => carrito.duplicarArticulo(n.clave)}
                      className="min-h-9 px-3 rounded-lg border border-[var(--c-borde)] text-sm"
                    >
                      Duplicar
                    </button>
                    {descuento.disponible && (
                      <BotonDescuento
                        pct={n.manualPct}
                        onAbrir={() => onDescuento({ clave: n.clave, nombre: `${n.servicio.nombre} · ${n.precio.tipo}` })}
                        onQuitar={() => carrito.quitarDescuento(n.clave)}
                      />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{dinero(n.totalArticulo)}</p>
                    {n.descuento > 0 && <p className="text-xs text-neutral-400 line-through">{dinero(n.totalSinPromo)}</p>}
                  </div>
                </div>
              </li>
            );
          })}

          {lineas.map((l) => {
            const decimal = permiteDecimales(l.presentacion.unidad);
            return (
              <li key={l.clave} className="rounded-2xl border border-[var(--c-borde)] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.producto.nombre}</p>
                    <p className="text-xs text-neutral-500 truncate">{l.presentacion.nombre}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Quitar"
                    onClick={() => carrito.quitar(l.presentacion.id)}
                    className="size-8 shrink-0 rounded-full bg-[#f3efe6] text-neutral-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 mt-3">
                  {decimal ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      value={l.cantidad}
                      onChange={(e) => e.target.value !== '' && carrito.poner(l.presentacion.id, e.target.value)}
                      className="w-28 min-h-11 px-3 rounded-xl border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)]"
                      aria-label="Cantidad"
                    />
                  ) : (
                    <div className="inline-flex items-center rounded-xl border border-[var(--c-borde)]">
                      <button
                        type="button"
                        aria-label="Menos"
                        onClick={() => (l.cantidad <= 1 ? carrito.quitar(l.presentacion.id) : carrito.poner(l.presentacion.id, l.cantidad - 1))}
                        className="size-11 text-lg"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-semibold">{l.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Más"
                        onClick={() => carrito.poner(l.presentacion.id, l.cantidad + 1)}
                        className="size-11 text-lg"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="font-semibold">{dinero(l.total)}</p>
                    {l.ahorro > 0 && <p className="text-xs text-neutral-400 line-through">{dinero(l.totalSinPromo)}</p>}
                    {l.origenPrecio === 'mayoreo' && l.ahorro === 0 && (
                      <p className="text-xs text-emerald-700">Mayoreo: {dinero(l.precioAplicado)} c/u</p>
                    )}
                  </div>
                </div>

                {l.partes
                  .filter((p) => p.promocion)
                  .map((p, i) => (
                    <p key={i} className="mt-2 text-xs font-medium text-emerald-700">
                      {p.promocion}
                      {l.partes.length > 1 ? ` (${p.cantidad} pzas)` : ''} · −{dinero(p.descuento)}
                    </p>
                  ))}

                {l.proximoMayoreo && l.ahorro === 0 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Llevando {l.proximoMayoreo.cantidadMinima} cada uno sale a {dinero(l.proximoMayoreo.precio)}
                  </p>
                )}

                {descuento.disponible && (
                  <div className="mt-2">
                    <BotonDescuento
                      pct={l.manualPct}
                      onAbrir={() => onDescuento({ clave: l.clave, nombre: l.producto.nombre })}
                      onQuitar={() => carrito.quitarDescuento(l.clave)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1">
        {incluyeIva && totales.desglosado && (
          <>
            <div className="flex justify-between text-sm text-neutral-500">
              <span>Subtotal</span>
              <span>{dinero(totales.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-neutral-500">
              <span>IVA</span>
              <span>{dinero(totales.iva)}</span>
            </div>
          </>
        )}
        {carrito.ahorro > 0 && (
          <div className="flex justify-between text-sm font-medium text-emerald-700">
            <span>Ahorro</span>
            <span>{dinero(carrito.ahorro)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-semibold tracking-tight">{dinero(totales.total)}</span>
        </div>

        {carrito.faltaAutorizacion && (
          <div className="rounded-xl bg-amber-50 text-amber-800 text-xs p-3 mt-2">
            Falta la autorización del encargado para el descuento.{' '}
            <button type="button" onClick={() => onDescuento({ clave: null })} className="font-semibold underline underline-offset-2">
              Autorizar
            </button>
          </div>
        )}

        <Boton className="w-full mt-3" disabled={carrito.vacio || carrito.faltaAutorizacion} onClick={onCobrar}>
          {carrito.tieneServicios ? 'Cobrar abono' : 'Cobrar'}
        </Boton>
      </div>
    </div>
  );
}