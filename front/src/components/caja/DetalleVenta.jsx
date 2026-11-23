import { useEffect, useState } from 'react';
import { nombreUnidad } from '@plataforma/calculos';
import * as svc from '../../services/ventasMostrador.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import ComprobanteAjuste from './ComprobanteAjuste.jsx';
import EtiquetaVenta from './EtiquetaVenta.jsx';
import ModalDevolver from './ModalDevolver.jsx';
import TicketVenta from './TicketVenta.jsx';
import { ventaATicket } from './ventaATicket.js';
import { useDetalleVenta } from './useDetalleVenta.js';

export default function DetalleVenta({ id, onVolver, onOperando }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const d = useDetalleVenta(id);
  const venta = d.venta;

  const [devolviendo, setDevolviendo] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  const [copia, setCopia] = useState(null);
  const [cargandoCopia, setCargandoCopia] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  // Mientras se devuelve, la pantalla de Caja no deja hacer el corte
  useEffect(() => {
    onOperando?.(devolviendo);
    return () => onOperando?.(false);
  }, [devolviendo, onOperando]);

  if (copia) return <TicketVenta venta={ventaATicket(copia)} esCopia onVolver={() => setCopia(null)} />;

  if (comprobante) {
    return (
      <ComprobanteAjuste
        comprobante={comprobante}
        onCerrar={async () => {
          setComprobante(null);
          if (!(await d.recargar())) onVolver();
        }}
      />
    );
  }

  if (d.cargando && !venta) return <p className="text-neutral-400">Cargando…</p>;
  if (!venta) {
    return (
      <div className="max-w-md space-y-4">
        <MensajeError error={d.error || 'No se pudo cargar la venta'} />
        <Boton variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    );
  }

  const verCopia = async () => {
    setCargandoCopia(true);
    setErrorAccion('');
    try {
      setCopia(await svc.copia(id));
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setCargandoCopia(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1 min-h-11 pr-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <Icono nombre="atras" className="size-5" />
          Ventas
        </button>
        <h2 className="text-xl font-semibold tracking-tight">{venta.folio}</h2>
        <EtiquetaVenta estado={venta.estado} />
      </div>

      {errorAccion && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={errorAccion} />
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_24rem] lg:gap-6 lg:items-start">
        <section className="space-y-5">
          <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <h3 className="font-semibold tracking-tight mb-3">Productos</h3>
            <ul className="divide-y divide-[var(--c-borde)] text-sm">
              {venta.productos.map((p) => (
                <li key={p.partidaId} className="py-3 flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-xs text-neutral-400">
                      {p.cantidad} {nombreUnidad(p.unidad ?? 'pieza').toLowerCase()} × {dinero(p.precio)}
                      {p.origenPrecio === 'mayoreo' ? ' (mayoreo)' : ''}
                    </p>
                    {p.cantidadDevuelta > 0 && (
                      <p className="text-xs font-medium text-red-700 mt-0.5">
                        Se devolvió {p.cantidadDevuelta} · {dinero(p.valorDevuelto)}
                      </p>
                    )}
                  </div>
                  <span className="font-medium shrink-0">{dinero(p.total)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <h3 className="font-semibold tracking-tight mb-3">Pagos</h3>
            <ul className="divide-y divide-[var(--c-borde)] text-sm">
              {venta.pagos.map((p, i) => (
                <li key={i} className="py-2 flex justify-between gap-3">
                  <div className="min-w-0">
                    <p>
                      {ETIQUETA_FORMA[p.forma]}
                      {p.referencia ? ` · ${p.referencia}` : ''}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {formatearFechaHora(p.creadoEn, venta.zonaHoraria)} · {p.cobro} · {p.caja}
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{dinero(p.monto)}</span>
                </li>
              ))}
            </ul>
          </div>

          {venta.reembolsos.length > 0 && (
            <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
              <h3 className="font-semibold tracking-tight mb-3">Devoluciones</h3>
              <ul className="divide-y divide-[var(--c-borde)] text-sm">
                {venta.reembolsos.map((r, i) => (
                  <li key={i} className="py-2 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p>
                        Devolución · {ETIQUETA_FORMA[r.forma]}
                        {r.referencia ? ` · ${r.referencia}` : ''}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatearFechaHora(r.creadoEn, venta.zonaHoraria)} · {r.quien} · {r.caja}
                      </p>
                      <p className="text-xs text-neutral-500">{r.motivo}</p>
                    </div>
                    <span className="font-medium shrink-0 text-red-700">−{dinero(r.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="order-first lg:order-none lg:sticky lg:top-20">
          <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 space-y-4">
            <div>
              <p className="font-semibold">{venta.cliente ? venta.cliente.nombre : 'Sin cliente'}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {[venta.sucursal, venta.caja, venta.cajero].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-neutral-400">{formatearFechaHora(venta.creadaEn, venta.zonaHoraria)}</p>
            </div>

            <div className="space-y-1 text-sm border-t border-[var(--c-borde)] pt-4">
              <div className="flex justify-between text-neutral-600">
                <span>Total de la venta</span>
                <span>{dinero(venta.total)}</span>
              </div>
              {venta.devuelto > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Devuelto</span>
                  <span>−{dinero(venta.devuelto)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold">
                <span>Vale ahora</span>
                <span>{dinero(venta.vale)}</span>
              </div>
            </div>

            <div className="space-y-2">
              {venta.puedeDevolver && (
                <Boton className="w-full" onClick={() => setDevolviendo(true)}>
                  Devolver productos
                </Boton>
              )}
              <Boton variante="secundario" className="w-full" cargando={cargandoCopia} onClick={verCopia}>
                Ver copia del ticket
              </Boton>
            </div>
          </div>
        </aside>
      </div>

      {devolviendo && (
        <ModalDevolver
          venta={venta}
          onListo={(c) => {
            setDevolviendo(false);
            setComprobante(c);
          }}
          onCerrar={() => setDevolviendo(false)}
        />
      )}
    </div>
  );
}