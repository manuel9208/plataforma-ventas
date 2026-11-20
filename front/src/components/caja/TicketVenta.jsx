import { nombreUnidad, totalAhorro } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import { agruparServicios } from './agruparServicios.js';
import BotonesImpresion from './BotonesImpresion.jsx';

const ESTADO_PAGO = { pendiente: 'Sin pago', abonada: 'Abonada', pagada: 'Pagada' };

// esCopia + onVolver: reimpresión desde Notas (sin PIN). Sin ellos es el ticket recién cobrado.
export default function TicketVenta({ venta, onNueva, esCopia = false, onVolver }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const cambio = venta.pagos.reduce((s, p) => s + p.cambio, 0);
  const esNota = venta.tieneServicios;
  // Los servicios y sus extras se muestran en su propio bloque; aquí solo los productos
  const productos = venta.partidas.filter((p) => p.tipo === 'producto');
  const ahorro = totalAhorro([...productos, ...venta.servicios]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
        {esCopia && (
          <p className="mb-3 mx-auto w-fit rounded-full border-2 border-neutral-300 px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-neutral-500">
            Copia
          </p>
        )}
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {esNota ? 'Nota de servicio' : 'Venta cobrada'}
        </p>
        <h2 className="text-center text-xl font-semibold tracking-tight mt-1">{venta.folio}</h2>
        <p className="text-center text-sm text-neutral-500">
          {empresa.nombre} · {venta.sucursal}
        </p>
        <p className="text-center text-xs text-neutral-400">
          {formatearFechaHora(venta.creadaEn, venta.zonaHoraria)} · {venta.caja} · {venta.cajero}
        </p>
        {venta.cliente && (
          <p className="text-center text-sm text-neutral-600 mt-2">
            {venta.cliente.nombre} · {venta.cliente.telefono}
          </p>
        )}

        {esNota && (
          <div className="mt-5 space-y-3">
            {agruparServicios(venta.servicios).map((g) => {
              const datos = Object.values(g.articulo).join(' · ');
              return (
                <div key={g.id} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-3 text-sm">
                  {datos && <p className="font-semibold">{datos}</p>}
                  <div className={`space-y-2 ${datos ? 'mt-2' : ''}`}>
                    {g.servicios.map((s) => (
                      <div key={s.partidaId}>
                        <div className="flex justify-between gap-3">
                          <p className="font-medium">{s.nombre}</p>
                          <span className="font-medium shrink-0">{dinero(s.total)}</span>
                        </div>
                        {s.promocion && (
                          <p className="text-xs font-medium text-emerald-700 mt-0.5">
                            {s.promocion} · ahorro {dinero(s.descuento)}
                          </p>
                        )}
                        {s.extras.map((x, i) => (
                          <div key={i} className="flex justify-between text-xs text-neutral-500 mt-0.5">
                            <span>+ {x.nombre}</span>
                            <span>{dinero(x.total)}</span>
                          </div>
                        ))}
                        {s.cargoFinanciamiento > 0 && (
                          <p className="text-xs text-neutral-500 mt-0.5">Incluye financiamiento {dinero(s.cargoFinanciamiento)}</p>
                        )}
                        <p className="text-xs text-[var(--c-primario)] font-medium mt-0.5">Entrega: {formatearFechaLarga(s.fechaPrometida)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {productos.length > 0 && (
          <ul className="mt-5 divide-y divide-[var(--c-borde)] text-sm">
            {productos.map((p) => (
              <li key={p.orden} className="py-2 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate">{p.nombre}</p>
                  <p className="text-xs text-neutral-400">
                    {p.cantidad} {nombreUnidad(p.unidad ?? 'pieza').toLowerCase()} × {dinero(p.precioAplicado)}
                    {p.origenPrecio === 'mayoreo' ? ' (mayoreo)' : ''}
                  </p>
                  {p.promocion && (
                    <p className="text-xs font-medium text-emerald-700">
                      {p.promocion} · ahorro {dinero(p.descuento)}
                    </p>
                  )}
                </div>
                <span className="font-medium shrink-0">{dinero(p.total)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm">
          {venta.preciosIncluyenIva && venta.subtotal !== null && (
            <>
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span>{dinero(venta.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>IVA</span>
                <span>{dinero(venta.iva)}</span>
              </div>
            </>
          )}
          {ahorro > 0 && (
            <div className="flex justify-between font-medium text-emerald-700">
              <span>Ahorraste</span>
              <span>{dinero(ahorro)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="font-medium">Total</span>
            <span className="text-xl font-semibold">{dinero(venta.total)}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm text-neutral-600">
          {venta.pagos.length === 0 && <p className="text-center text-neutral-400">Sin pago</p>}
          {venta.pagos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {ETIQUETA_FORMA[p.forma]}
                {p.referencia ? ` · ${p.referencia}` : ''}
              </span>
              <span>{dinero(p.monto)}</span>
            </div>
          ))}
          {cambio > 0 && (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Cambio</span>
              <span>{dinero(cambio)}</span>
            </div>
          )}
          {esNota && (
            <>
              <div className="flex justify-between pt-1">
                <span>Pagado</span>
                <span>{dinero(venta.pagado)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Saldo · {ESTADO_PAGO[venta.estadoPago]}</span>
                <span>{dinero(venta.saldo)}</span>
              </div>
            </>
          )}
        </div>

        {venta.pinEntrega && (
          <div className="mt-5 rounded-2xl border-2 border-dashed border-[var(--c-acento)] bg-amber-50/50 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">PIN de entrega</p>
            <p className="text-4xl font-semibold tracking-[0.3em] mt-1">{venta.pinEntrega}</p>
            <p className="text-xs text-neutral-500 mt-2">
              Dáselo al cliente. Lo necesitará para recoger. Esta es la única vez que se muestra.
            </p>
          </div>
        )}
        {esNota && venta.tienePin && !venta.pinEntrega && (
          <p className="mt-4 text-center text-xs text-neutral-400">El PIN ya se entregó y no se puede volver a mostrar.</p>
        )}

        {venta.pieRecepcion && (
          <p className="mt-5 pt-4 border-t border-[var(--c-borde)] text-center text-xs text-neutral-500 whitespace-pre-line">{venta.pieRecepcion}</p>
        )}
      </div>

      {venta.repetida && <p className="text-center text-xs text-neutral-400">Esta venta ya estaba registrada; no se cobró de nuevo.</p>}
      <BotonesImpresion venta={venta} esCopia={esCopia} automatico={!esCopia && !venta.repetida} onTerminar={onNueva} />
      {onVolver ? (
        <Boton className="w-full" onClick={onVolver}>
          Volver a la nota
        </Boton>
      ) : (
        <Boton className="w-full" onClick={onNueva}>
          {esNota ? 'Nueva nota' : 'Nueva venta'}
        </Boton>
      )}
    </div>
  );
}