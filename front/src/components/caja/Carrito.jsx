import { permiteDecimales } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda, formatearTelefono } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import Interruptor from '../shared/Interruptor.jsx';

const BOTON = 'min-h-9 px-3 rounded-lg border border-[var(--c-borde)] text-sm disabled:opacity-40';

function BotonDescuento({ pct, onAbrir, onQuitar }) {
  return pct ? (
    <span className="inline-flex items-center gap-1 pl-3 pr-1 min-h-9 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold">
      Descuento manual −{pct}%
      <button type="button" aria-label="Quitar descuento" onClick={onQuitar} className="size-7 rounded-md hover:bg-white">
        ✕
      </button>
    </span>
  ) : (
    <button type="button" onClick={onAbrir} className={BOTON}>
      Descuento
    </button>
  );
}

// onEditarDatos(grupo) · onEditarServicio(grupo, servicio) · onOtroServicio(grupo) · onCliente() · onDescuento({ clave, nombre })
export default function Carrito({
  carrito,
  incluyeIva,
  descuento,
  onCobrar,
  onVaciar,
  onEditarDatos,
  onEditarServicio,
  onOtroServicio,
  onCliente,
  onDescuento,
  adicion = false,
}) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { lineas, grupos, totales } = carrito;

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

      {carrito.tieneServicios && !adicion && (
        <button
          type="button"
          onClick={onCliente}
          className="mb-3 w-full text-left rounded-2xl border border-[var(--c-borde)] bg-white px-4 py-3 min-h-12 hover:border-[var(--c-acento)]"
        >
          {carrito.cliente ? (
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium truncate">{carrito.cliente.vista.nombre}</span>
                <span className="block text-xs text-neutral-500">{formatearTelefono(carrito.cliente.vista.telefono)}</span>
              </span>
              <span className="text-sm font-medium text-[var(--c-primario)]">Cambiar</span>
            </span>
          ) : (
            <span className="text-sm text-neutral-500">+ Agregar cliente (también se pide al cobrar)</span>
          )}
        </button>
      )}

      {carrito.vacio ? (
        <p className="flex-1 grid place-items-center text-center text-neutral-400 py-10">
          Escanea un producto o toca uno del catálogo.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-3 pr-1">
          {grupos.map((g) => {
            const datos = Object.values(g.datos).filter(Boolean).join(' · ');
            const motivoOtro = carrito.motivoServicio(g.clave);
            const motivoDup = carrito.motivoDuplicar(g.clave);
            return (
              <li key={g.clave} className="rounded-2xl border border-[var(--c-borde)] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{datos || 'Artículo'}</p>
                    {g.comentario && <p className="text-xs text-neutral-500 italic truncate">Nota interna: {g.comentario}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label="Quitar artículo"
                    onClick={() => carrito.quitarArticulo(g.clave)}
                    className="size-8 shrink-0 rounded-full bg-[#f3efe6] text-neutral-500"
                  >
                    ✕
                  </button>
                </div>

                <ul className="mt-3 space-y-2">
                  {g.servicios.map((s) => (
                    <li key={s.clave} className="rounded-xl bg-[#faf8f3] border border-[var(--c-borde)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {s.servicio.nombre} · {s.precio.tipo}
                          </p>
                          <p className="text-xs text-neutral-400">Entrega: {formatearFechaLarga(s.fechaMostrada)}</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Quitar servicio"
                          onClick={() => carrito.quitarServicio(s.clave)}
                          className="size-7 shrink-0 rounded-full bg-white text-neutral-500 text-sm"
                        >
                          ✕
                        </button>
                      </div>

                      {s.extras.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
                          {s.extras.map((x) => (
                            <li key={x.id} className="flex justify-between">
                              <span>+ {x.nombre}</span>
                              <span>{dinero(x.total)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {s.cargoFin > 0 && (
                        <p className="mt-1.5 flex justify-between text-xs text-neutral-500">
                          <span>Financiamiento</span>
                          <span>{dinero(s.cargoFin)}</span>
                        </p>
                      )}

                      {s.promocion && (
                        <p className="mt-1.5 text-xs font-medium text-emerald-700">
                          {s.promocion} · −{dinero(s.descuento)}
                        </p>
                      )}

                      <div className="flex items-end justify-between gap-3 mt-2">
                        <div className="flex flex-wrap gap-2">
                          {!s.servicio.requiereCotizacion && (
                            <button type="button" onClick={() => onEditarServicio(g, s)} className={BOTON}>
                              Editar
                            </button>
                          )}
                          {descuento.disponible && !s.servicio.requiereCotizacion && (
                            <BotonDescuento
                              pct={s.manualPct}
                              onAbrir={() => onDescuento({ clave: s.clave, nombre: `${s.servicio.nombre} · ${s.precio.tipo}` })}
                              onQuitar={() => carrito.quitarDescuento(s.clave)}
                            />
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {s.servicio.requiereCotizacion ? (
                            <p className="font-semibold text-sm text-amber-700">Por cotizar</p>
                          ) : (
                            <p className="font-semibold text-sm">{dinero(s.totalServicio)}</p>
                          )}
                          {s.descuento > 0 && <p className="text-xs text-neutral-400 line-through">{dinero(s.totalSinPromo)}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onEditarDatos(g)} className={BOTON}>
                      Datos
                    </button>
                    <button type="button" disabled={Boolean(motivoOtro)} onClick={() => onOtroServicio(g)} className={BOTON}>
                      + Otro servicio
                    </button>
                    <button type="button" disabled={Boolean(motivoDup)} onClick={() => carrito.duplicarArticulo(g.clave)} className={BOTON}>
                      Duplicar
                    </button>
                  </div>
                  <p className="font-semibold">{dinero(g.total)}</p>
                </div>
                {(motivoOtro || motivoDup) && <p className="mt-2 text-xs text-amber-700">{motivoOtro || motivoDup}</p>}
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
        {carrito.puntos.actual && (
          <div className="flex justify-between text-sm font-medium text-emerald-700">
            <span>Puntos ({carrito.puntos.actual.puntos})</span>
            <span>−{dinero(carrito.puntos.actual.descuento)}</span>
          </div>
        )}
        {carrito.puntos.error && (
          <div className="rounded-xl bg-amber-50 text-amber-800 text-xs p-3 mt-2">
            Los puntos ya no aplican: {carrito.puntos.error}{' '}
            <button type="button" onClick={carrito.puntos.quitar} className="font-semibold underline underline-offset-2">
              Quitar puntos
            </button>
          </div>
        )}
        {carrito.cupon.actual && (
          <div className="flex justify-between text-sm font-medium text-emerald-700">
            <span>Cupón {carrito.cupon.info.codigo}</span>
            <span>−{dinero(carrito.cupon.actual.descuento)}</span>
          </div>
        )}
        {carrito.cupon.error && (
          <div className="rounded-xl bg-amber-50 text-amber-800 text-xs p-3 mt-2">
            {carrito.cupon.error}{' '}
            <button type="button" onClick={carrito.cupon.quitar} className="font-semibold underline underline-offset-2">
              Quitar cupón
            </button>
          </div>
        )}
        {carrito.numPorCotizar > 0 && (
          <p className="rounded-xl bg-amber-50 text-amber-800 text-xs p-3">
            {carrito.numPorCotizar} {carrito.numPorCotizar === 1 ? 'servicio se cotiza' : 'servicios se cotizan'} después. Su precio se suma al cotizar la nota.
          </p>
        )}
        {carrito.puedeFinanciar && carrito.tieneServicios && !adicion && (
          <div className="pb-2">
            <Interruptor
              etiqueta="Financiado"
              descripcion={
                carrito.cargoFinanciamiento > 0
                  ? `Sin anticipo de los servicios. Cargo de ${dinero(carrito.cargoFinanciamiento)} por servicio.`
                  : 'Sin anticipo de los servicios.'
              }
              valor={carrito.financiada}
              onCambiar={carrito.ponerFinanciada}
            />
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

        <Boton className="w-full mt-3" disabled={carrito.vacio || carrito.faltaAutorizacion || Boolean(carrito.puntos.error) || Boolean(carrito.cupon.error)} onClick={onCobrar}>
          {adicion ? 'Agregar a la nota' : carrito.tieneServicios ? (carrito.financiada ? 'Cobrar financiado' : 'Cobrar abono') : 'Cobrar'}
        </Boton>
      </div>
    </div>
  );
}