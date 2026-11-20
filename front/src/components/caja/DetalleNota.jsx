import { useEffect, useRef, useState } from 'react';
import { nombreUnidad } from '@plataforma/calculos';
import * as svc from '../../services/notas.service.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../utils/formasPago.js';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda, formatearTelefono } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';
import ModalMotivo from '../shared/ModalMotivo.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import Icono from '../shared/Icono.jsx';
import EtiquetaEstado from './EtiquetaEstado.jsx';
import ModalCobrarSaldo from './ModalCobrarSaldo.jsx';
import ReciboCobro from './ReciboCobro.jsx';
import ModalEntrega from './ModalEntrega.jsx';
import TicketEntrega from './TicketEntrega.jsx';
import ModalCancelar from './ModalCancelar.jsx';
import ModalReembolso from './ModalReembolso.jsx';
import ComprobanteAjuste from './ComprobanteAjuste.jsx';
import TicketVenta from './TicketVenta.jsx';
import { notaATicket } from './notaATicket.js';
import { useDetalleNota } from './useDetalleNota.js';
import { agruparServicios } from './agruparServicios.js';

const PENDIENTE = ['recibido', 'en_proceso'];
const HECHO = ['listo', 'entregado'];

export default function DetalleNota({ id, accionInicial, onVolver, onOperando }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const d = useDetalleNota(id);
  const nota = d.nota;

  const [cobrando, setCobrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorCobro, setErrorCobro] = useState('');
  const [recibo, setRecibo] = useState(null);
  const [aListo, setAListo] = useState(null); // ids de artículos por marcar como listos
  const [aEspera, setAEspera] = useState(null); // id del artículo que regresa a En espera
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [copia, setCopia] = useState(null);
  const [cargandoCopia, setCargandoCopia] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [ticketEntrega, setTicketEntrega] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [reembolsando, setReembolsando] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  // El id del cobro se reutiliza si hay que reintentar: así nunca se cobra dos veces
  const idCobro = useRef(nuevoUuid());
  const atajoHecho = useRef(false);

  // Mientras se cobra, se entrega, se cancela o se reembolsa, la pantalla de Caja no deja cerrar el turno
  useEffect(() => {
    onOperando?.(cobrando || enviando || entregando || cancelando || reembolsando);
    return () => onOperando?.(false);
  }, [cobrando, enviando, entregando, cancelando, reembolsando, onOperando]);

  // Atajo de la tarjeta: abre directo el cobro, la confirmación de "listo" o la entrega
  useEffect(() => {
    if (!nota || atajoHecho.current) return;
    atajoHecho.current = true;
    const pendientes = nota.servicios.filter((s) => PENDIENTE.includes(s.estado)).map((s) => s.partidaId);
    if (accionInicial === 'cobrar' && nota.saldo > 0) setCobrando(true);
    if (accionInicial === 'listo' && pendientes.length) setAListo(pendientes);
    if (accionInicial === 'entregar' && nota.saldo === 0 && nota.servicios.some((s) => s.estado === 'listo')) setEntregando(true);
  }, [nota, accionInicial]);

  if (copia) return <TicketVenta venta={notaATicket(copia)} esCopia onVolver={() => setCopia(null)} />;

  // Al cerrar el ticket: si la nota quedó entregada completa, un cajero ya no puede verla, así que se vuelve a la lista
  if (ticketEntrega) {
    return (
      <TicketEntrega
        ticket={ticketEntrega}
        onCerrar={() => {
          const termino = ticketEntrega.pendientes === 0;
          setTicketEntrega(null);
          if (termino) onVolver();
        }}
      />
    );
  }

  // Al cerrar el comprobante se recarga la nota; si ya no es visible para este usuario, se vuelve a la lista
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

  if (d.cargando && !nota) return <p className="text-neutral-400">Cargando…</p>;
  if (!nota) {
    return (
      <div className="max-w-md space-y-4">
        <MensajeError error={d.error || 'No se pudo cargar la nota'} />
        <Boton variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    );
  }

  const pendientes = nota.servicios.filter((s) => PENDIENTE.includes(s.estado));
  const hayListos = nota.servicios.some((s) => s.estado === 'listo');
  const hayHechos = nota.servicios.some((s) => HECHO.includes(s.estado));
  const productosVigentes = nota.productos.filter((p) => !p.devuelto);
  const puedeCancelar = pendientes.length > 0 || productosVigentes.length > 0;
  const hayAjustes = nota.cancelado > 0 || nota.ajustado > 0 || nota.retenido > 0 || nota.reembolsado > 0;
  const devuelto = nota.reembolsos.reduce((s, r) => s + r.monto, 0);

  const cobrarSaldo = async ({ pagos }) => {
    setEnviando(true);
    setErrorCobro('');
    try {
      const r = await svc.cobrar(id, { id: idCobro.current, pagos });
      setRecibo(r);
      setCobrando(false);
      idCobro.current = nuevoUuid();
      await d.recargar();
    } catch (e) {
      setErrorCobro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const marcarListo = async () => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await d.cambiarEstado({ estado: 'listo', partidaIds: aListo });
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setProcesando(false);
      setAListo(null);
    }
  };

  const regresarAEspera = async (motivo) => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await d.cambiarEstado({ estado: 'en_espera', partidaIds: [aEspera], motivo });
      setAEspera(null);
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setProcesando(false);
    }
  };

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

  const entregada = (ticket) => {
    setEntregando(false);
    // Lo que sigue pendiente de la nota, para el ticket (lo recién entregado sale en "Entregado hoy")
    const entregados = new Set(ticket.articulos.map((a) => a.partidaId));
    const faltan = nota.servicios.filter((s) => s.estado !== 'cancelado' && s.estado !== 'entregado' && !entregados.has(s.partidaId));
    setTicketEntrega({ ...ticket, faltan });
    // Si ya no queda nada pendiente, no se recarga: la nota pasó a Entregadas
    if (ticket.pendientes > 0) d.recargar();
  };

  const ajusteHecho = (c) => {
    setCancelando(false);
    setReembolsando(false);
    setComprobante(c);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1 min-h-11 pr-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <Icono nombre="atras" className="size-5" />
          Notas
        </button>
        <h2 className="text-xl font-semibold tracking-tight">{nota.folio}</h2>
      </div>

      {errorAccion && !aEspera && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={errorAccion} />
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_24rem] lg:gap-6 lg:items-start">
        <section className="space-y-5">
          <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <h3 className="font-semibold tracking-tight mb-3">Artículos</h3>
            <div className="space-y-3">
              {agruparServicios(nota.servicios).map((g) => {
                const datos = Object.values(g.articulo).join(' · ');
                return (
                  <div key={g.id} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4">
                    {datos && <p className="font-semibold">{datos}</p>}
                    {g.comentario && <p className="text-xs text-neutral-500 italic mt-0.5">Nota interna: {g.comentario}</p>}
                    <div className={`space-y-3 ${datos || g.comentario ? 'mt-3' : ''}`}>
                      {g.servicios.map((s) => {
                        const cambioFecha = s.fechaPrometidaOriginal && s.fechaPrometidaOriginal !== s.fechaPrometida;
                        const cancelado = s.estado === 'cancelado';
                        return (
                          <div key={s.partidaId} className={`rounded-xl bg-white border border-[var(--c-borde)] p-3 ${cancelado ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`font-medium ${cancelado ? 'line-through' : ''}`}>{s.nombre}</p>
                                {s.extras.map((x, i) => (
                                  <p key={i} className="text-xs text-neutral-500 mt-0.5">
                                    + {x.nombre} · {dinero(x.total)}
                                  </p>
                                ))}
                                {s.cargoFinanciamiento > 0 && (
                                  <p className="text-xs text-neutral-500 mt-0.5">Incluye financiamiento · {dinero(s.cargoFinanciamiento)}</p>
                                )}
                              </div>
                              <EtiquetaEstado estado={s.estado} />
                            </div>
                            {!cancelado && (
                              <p className="text-xs text-[var(--c-primario)] font-medium mt-2">
                                Entrega: {formatearFechaLarga(s.fechaPrometida)}
                                {cambioFecha ? ` (antes ${formatearFechaLarga(s.fechaPrometidaOriginal)})` : ''}
                              </p>
                            )}
                            {s.estado === 'listo' && s.listoEn && (
                              <p className="text-xs text-neutral-400 mt-0.5">Listo desde {formatearFechaHora(s.listoEn, nota.zonaHoraria)}</p>
                            )}
                            <div className="flex items-center justify-between gap-3 mt-3">
                              <span className={`font-semibold ${cancelado ? 'line-through' : ''}`}>{dinero(s.total)}</span>
                              {PENDIENTE.includes(s.estado) && (
                                <Boton compacto onClick={() => setAListo([s.partidaId])}>
                                  Marcar listo
                                </Boton>
                              )}
                              {s.estado === 'listo' && nota.puedeGestionar && (
                                <Boton
                                  compacto
                                  variante="secundario"
                                  onClick={() => {
                                    setErrorAccion('');
                                    setAEspera(s.partidaId);
                                  }}
                                >
                                  Regresar a En espera
                                </Boton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {nota.productos.length > 0 && (
            <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
              <h3 className="font-semibold tracking-tight mb-3">Productos</h3>
              <ul className="divide-y divide-[var(--c-borde)] text-sm">
                {nota.productos.map((p, i) => (
                  <li key={i} className={`py-2 flex justify-between gap-3 ${p.devuelto ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <p className={`truncate ${p.devuelto ? 'line-through' : ''}`}>
                        {p.nombre}
                        {p.devuelto && (
                          <span className="ml-2 no-underline text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200">
                            Devuelto
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {p.cantidad} {nombreUnidad(p.unidad ?? 'pieza').toLowerCase()} × {dinero(p.precio)}
                      </p>
                    </div>
                    <span className={`font-medium shrink-0 ${p.devuelto ? 'line-through' : ''}`}>{dinero(p.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
            <h3 className="font-semibold tracking-tight mb-3">Pagos</h3>
            {nota.pagos.length === 0 ? (
              <p className="text-sm text-neutral-400">Aún no hay pagos.</p>
            ) : (
              <ul className="divide-y divide-[var(--c-borde)] text-sm">
                {nota.pagos.map((p, i) => (
                  <li key={i} className="py-2 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p>
                        {ETIQUETA_FORMA[p.forma]}
                        {p.referencia ? ` · ${p.referencia}` : ''}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatearFechaHora(p.creadoEn, nota.zonaHoraria)} · {p.cobro} · {p.caja}
                      </p>
                    </div>
                    <span className="font-medium shrink-0">{dinero(p.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {nota.reembolsos.length > 0 && (
            <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
              <h3 className="font-semibold tracking-tight mb-3">Devoluciones</h3>
              <ul className="divide-y divide-[var(--c-borde)] text-sm">
                {nota.reembolsos.map((r, i) => (
                  <li key={i} className="py-2 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p>
                        {r.tipo === 'cancelacion' ? 'Por cancelación' : 'Reembolso'} · {ETIQUETA_FORMA[r.forma]}
                        {r.referencia ? ` · ${r.referencia}` : ''}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatearFechaHora(r.creadoEn, nota.zonaHoraria)} · {r.quien} · {r.caja}
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
              <p className="font-semibold">{nota.cliente ? nota.cliente.nombre : 'Sin cliente'}</p>
              {nota.cliente && <p className="text-sm text-neutral-500">{formatearTelefono(nota.cliente.telefono)}</p>}
              <p className="text-xs text-neutral-400 mt-1">
                {nota.sucursal} · {nota.caja} · {nota.cajero}
              </p>
              <p className="text-xs text-neutral-400">Recibida {formatearFechaHora(nota.creadaEn, nota.zonaHoraria)}</p>
              {nota.financiada && <p className="text-xs font-medium text-amber-700 mt-0.5">Nota financiada</p>}
            </div>

            <div className="space-y-1 text-sm border-t border-[var(--c-borde)] pt-4">
              {hayAjustes && (
                <>
                  <div className="flex justify-between text-neutral-500">
                    <span>Total original</span>
                    <span>{dinero(nota.totalOriginal)}</span>
                  </div>
                  {nota.cancelado > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Cancelado</span>
                      <span>−{dinero(nota.cancelado)}</span>
                    </div>
                  )}
                  {nota.ajustado > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Reembolsos</span>
                      <span>−{dinero(nota.ajustado)}</span>
                    </div>
                  )}
                  {nota.retenido > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Retenido por el trabajo</span>
                      <span>+{dinero(nota.retenido)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-neutral-600">
                <span>{hayAjustes ? 'La nota vale' : 'Total'}</span>
                <span>{dinero(nota.total)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>{devuelto > 0 ? 'Pagado (sin lo devuelto)' : 'Pagado'}</span>
                <span>{dinero(nota.pagado)}</span>
              </div>
              <div className={`flex justify-between text-lg font-semibold ${nota.saldo > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                <span>{nota.saldo > 0 ? 'Saldo' : 'Pagada'}</span>
                <span>{dinero(nota.saldo)}</span>
              </div>
            </div>

            <div className="space-y-2">
              {nota.saldo > 0 && (
                <Boton
                  className="w-full"
                  onClick={() => {
                    setErrorCobro('');
                    setCobrando(true);
                  }}
                >
                  Cobrar saldo
                </Boton>
              )}
              {hayListos && (
                <>
                  <Boton className="w-full" disabled={nota.saldo > 0} onClick={() => setEntregando(true)}>
                    Entregar
                  </Boton>
                  {nota.saldo > 0 && <p className="text-xs text-amber-700 text-center">Cobra el saldo antes de entregar.</p>}
                </>
              )}
              {pendientes.length > 1 && (
                <Boton variante="secundario" className="w-full" onClick={() => setAListo(pendientes.map((s) => s.partidaId))}>
                  Marcar todo como listo
                </Boton>
              )}
              <Boton variante="secundario" className="w-full" cargando={cargandoCopia} onClick={verCopia}>
                Ver copia del ticket
              </Boton>
              {puedeCancelar && (
                <Boton variante="secundario" className="w-full" onClick={() => setCancelando(true)}>
                  Cancelar artículos
                </Boton>
              )}
              {hayHechos && (
                <Boton variante="secundario" className="w-full" onClick={() => setReembolsando(true)}>
                  Reembolsar dinero
                </Boton>
              )}
            </div>
          </div>
        </aside>
      </div>

      {cobrando && (
        <ModalCobrarSaldo saldo={nota.saldo} enviando={enviando} error={errorCobro} onConfirmar={cobrarSaldo} onCerrar={() => setCobrando(false)} />
      )}
      {recibo && <ReciboCobro recibo={recibo} onCerrar={() => setRecibo(null)} />}
      {entregando && <ModalEntrega nota={nota} onEntregada={entregada} onCerrar={() => setEntregando(false)} />}
      {cancelando && <ModalCancelar nota={nota} onListo={ajusteHecho} onCerrar={() => setCancelando(false)} />}
      {reembolsando && <ModalReembolso nota={nota} onListo={ajusteHecho} onCerrar={() => setReembolsando(false)} />}

      <ConfirmModal
        abierto={!!aListo}
        titulo="Marcar como listo"
        mensaje={aListo?.length === 1 ? 'Este artículo quedará como Listo para entregar.' : `${aListo?.length ?? 0} artículos quedarán como Listo para entregar.`}
        textoConfirmar="Marcar listo"
        cargando={procesando}
        onConfirmar={marcarListo}
        onCancelar={() => setAListo(null)}
      />

      {aEspera && (
        <ModalMotivo
          titulo="Regresar a En espera"
          mensaje="Escribe por qué este artículo vuelve a En espera. Queda registrado."
          textoConfirmar="Regresar"
          peligro={false}
          cargando={procesando}
          error={errorAccion}
          onConfirmar={regresarAEspera}
          onCancelar={() => setAEspera(null)}
        />
      )}
    </div>
  );
}