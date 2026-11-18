import { useCallback, useEffect, useState } from 'react';
import { ETIQUETA_CATEGORIA } from '@plataforma/calculos';
import * as svc from '../../../services/cortes.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { RESULTADO_CORTE, textoDiferencia } from '../../../utils/corte.js';
import { ETIQUETA_FORMA } from '../../../utils/formasPago.js';
import { formatearFechaHora, formatearFechaLarga, formatearHora, formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Icono from '../../shared/Icono.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const Tarjeta = ({ titulo, nota, children, className = '' }) => (
  <section className={`rounded-3xl bg-white border border-[var(--c-borde)] p-5 ${className}`}>
    <h3 className="font-semibold tracking-tight">{titulo}</h3>
    {nota && <p className="text-xs text-neutral-500 mt-0.5">{nota}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

const Fila = ({ etiqueta, valor, fuerte = false, suave = false, detalle }) => (
  <div className={`flex justify-between gap-3 py-1.5 ${fuerte ? 'font-semibold text-neutral-900 border-t border-[var(--c-borde)] mt-1 pt-2.5' : ''}`}>
    <div className="min-w-0">
      <p className={suave ? 'text-neutral-500' : fuerte ? '' : 'text-neutral-700'}>{etiqueta}</p>
      {detalle && <p className="text-xs text-neutral-400">{detalle}</p>}
    </div>
    <p className={`shrink-0 ${fuerte ? 'text-lg' : ''} ${suave ? 'text-neutral-500' : ''}`}>{valor}</p>
  </div>
);

// enCurso: el turno sigue abierto; se muestran las cifras de ahora, sin conteo ni descuadre
export default function DetalleCorte({ turnoId, enCurso = false, onVolver }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const [corte, setCorte] = useState(null);
  const [error, setError] = useState('');
  const [actualizando, setActualizando] = useState(false);

  const cargar = useCallback(async () => {
    setActualizando(true);
    try {
      setCorte(await (enCurso ? svc.obtenerEnCurso(turnoId) : svc.obtener(turnoId)));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setActualizando(false);
    }
  }, [turnoId, enCurso]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!corte) {
    return (
      <div className="max-w-md space-y-4">
        {error ? <MensajeError error={error} /> : <p className="text-neutral-400">Cargando…</p>}
        <Boton variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    );
  }

  const k = corte.calculo;
  const r = corte.resultado ? RESULTADO_CORTE[corte.resultado] : null;
  const zona = corte.zonaHoraria;
  const formas = [
    ['efectivo', k.cobrosEfectivo, k.reembolsosEfectivo, k.efectivoNeto],
    ['tarjeta', k.cobrosTarjeta, k.reembolsosTarjeta, k.tarjetaNeta],
    ['transferencia', k.cobrosTransferencia, k.reembolsosTransferencia, k.transferenciaNeta],
  ];
  const debiaEntregar = corte.dejado === null ? null : Number((k.esperado - corte.dejado).toFixed(2));
  const gastos = corte.movimientos.filter((m) => m.tipo === 'gasto');
  const retiros = corte.movimientos.filter((m) => m.tipo === 'retiro');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1 min-h-11 pr-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <Icono nombre="atras" className="size-5" />
          {enCurso ? 'Turnos abiertos' : 'Cortes'}
        </button>
        <h2 className="text-xl font-semibold tracking-tight">
          {corte.caja} · {corte.sucursal}
        </h2>
        {enCurso ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-sky-50 text-sky-800 border-sky-200">Turno abierto</span>
        ) : (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${r.clases}`}>{r.titulo}</span>
        )}
        {corte.cierreTardio && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200">Cierre tardío</span>
        )}
        {enCurso && (
          <Boton compacto variante="secundario" className="sm:ml-auto" cargando={actualizando} onClick={cargar}>
            Actualizar
          </Boton>
        )}
      </div>

      {enCurso ? (
        <p className="mb-5 text-sm rounded-xl px-3 py-3 border text-sky-900 bg-sky-50 border-sky-200">
          Así va el turno de {corte.cajero} hasta las {formatearHora(corte.consultadoEn, zona)}. Todavía no hay conteo: el descuadre se sabe al hacer el corte.
        </p>
      ) : (
        <p className="mb-5 text-sm text-neutral-500">
          Turno del {formatearFechaLarga(corte.fechaOperativa)} · {corte.cajero} · abrió a las {formatearHora(corte.abiertoEn, zona)} · cerró{' '}
          {formatearFechaHora(corte.cerradoEn, zona)}
          {corte.cerro && corte.cerro !== corte.cajero ? ` (cerrado por ${corte.cerro})` : ''}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Ventas cobradas" nota="Tarjeta y transferencia sirven para cuadrar con la terminal y el banco.">
          {formas.map(([forma, cobrado, devuelto, neto]) => (
            <Fila
              key={forma}
              etiqueta={ETIQUETA_FORMA[forma]}
              detalle={`Cobrado ${dinero(cobrado)}${devuelto > 0 ? ` · devuelto ${dinero(devuelto)}` : ''}`}
              valor={dinero(neto)}
            />
          ))}
          <Fila etiqueta="Total vendido" valor={dinero(k.ventaNeta)} fuerte />
          <p className="mt-2 text-xs text-neutral-400">
            {corte.ventas.total === 0
              ? 'No se levantó ninguna venta ni nota en este turno.'
              : `${corte.ventas.total} ${corte.ventas.total === 1 ? 'venta o nota levantada' : 'ventas o notas levantadas'} en este turno${
                  corte.ventas.notas ? `, ${corte.ventas.notas} con servicio` : ''
                }.`}
          </p>
        </Tarjeta>

        <Tarjeta titulo="Efectivo de la caja" nota={enCurso ? 'Lo que debería haber físicamente ahora.' : 'Lo que debía haber físicamente al cerrar.'}>
          <Fila etiqueta="Fondo inicial" valor={dinero(k.fondo)} />
          <Fila etiqueta="+ Cobros en efectivo" valor={dinero(k.cobrosEfectivo)} />
          <Fila etiqueta="− Devoluciones en efectivo" valor={dinero(k.reembolsosEfectivo)} suave={k.reembolsosEfectivo === 0} />
          <Fila etiqueta="− Gastos" valor={dinero(k.gastos)} suave={k.gastos === 0} />
          <Fila etiqueta="− Retiros" valor={dinero(k.retiros)} suave={k.retiros === 0} />
          <Fila etiqueta={enCurso ? 'Debería haber' : 'Debe haber'} valor={dinero(k.esperado)} fuerte />
        </Tarjeta>

        <Tarjeta titulo="Gastos y retiros" nota="Efectivo que salió de la caja durante el turno.">
          {corte.movimientos.length === 0 ? (
            <p className="text-sm text-neutral-400">No hubo gastos ni retiros.</p>
          ) : (
            <ul className="divide-y divide-[var(--c-borde)] text-sm">
              {corte.movimientos.map((m) => (
                <li key={m.id} className={`py-2 flex justify-between gap-3 ${m.anulado ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className={m.anulado ? 'line-through' : ''}>{m.tipo === 'retiro' ? 'Retiro de efectivo' : m.concepto}</p>
                    <p className="text-xs text-neutral-500">
                      {m.tipo === 'retiro' ? `Recibió ${m.recibe}` : ETIQUETA_CATEGORIA[m.categoria]}
                      {m.referencia ? ` · ${m.referencia}` : ''}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {m.hizo} · {formatearHora(m.creadoEn, zona)}
                    </p>
                    {m.anulado && (
                      <p className="text-xs text-neutral-500">
                        Anulado por {m.anulo}: {m.anuladoMotivo}
                      </p>
                    )}
                  </div>
                  <span className={`font-medium shrink-0 ${m.anulado ? 'line-through' : ''}`}>{dinero(m.monto)}</span>
                </li>
              ))}
            </ul>
          )}
          {corte.movimientos.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--c-borde)] text-sm text-neutral-600">
              <div className="flex justify-between">
                <span>Gastos ({gastos.filter((m) => !m.anulado).length})</span>
                <span>{dinero(k.gastos)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retiros ({retiros.filter((m) => !m.anulado).length})</span>
                <span>{dinero(k.retiros)}</span>
              </div>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Cancelaciones y devoluciones" nota="Lo devuelto por tarjeta o transferencia no mueve el efectivo de la caja.">
          {corte.ajustes.length === 0 ? (
            <p className="text-sm text-neutral-400">No hubo cancelaciones ni devoluciones.</p>
          ) : (
            <ul className="divide-y divide-[var(--c-borde)] text-sm">
              {corte.ajustes.map((a) => (
                <li key={a.id} className="py-2">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">
                      {a.tipo === 'devolucion' ? 'Devolución' : a.tipo === 'cancelacion' ? 'Cancelación' : 'Reembolso'} · {a.folio}
                    </p>
                    <p className="font-medium shrink-0 text-red-700">{a.devuelto > 0 ? `−${dinero(a.devuelto)}` : dinero(0)}</p>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {a.tipo === 'cancelacion' ? `Cancelado ${dinero(a.cancelado)} · ` : a.tipo === 'devolucion' ? `Valor ${dinero(a.cancelado)} · ` : ''}
                    {a.devuelto > 0 ? `Devuelto en ${ETIQUETA_FORMA[a.forma].toLowerCase()}` : 'No se devolvió dinero'}
                    {a.retenido > 0 ? ` · retenido ${dinero(a.retenido)}` : ''}
                  </p>
                  <p className="text-xs text-neutral-500">{a.motivo}</p>
                  <p className="text-xs text-neutral-400">
                    {a.hizo} · autorizó {a.autorizo} · {formatearHora(a.creadoEn, zona)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      {/* Las cuentas del cajero van al final. Un turno abierto todavía no tiene conteo. */}
      {!enCurso && (
        <section className={`mt-5 rounded-3xl border p-5 sm:p-6 ${r.clases}`}>
          <h3 className="font-semibold tracking-tight text-neutral-900">Cuentas del cajero</h3>
          {corte.sinConteo ? (
            <p className="mt-2">El turno se cerró sin conteo de efectivo. Debía haber {dinero(k.esperado)}.</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{textoDiferencia(corte.resultado, corte.diferencia, dinero)}</p>
              <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 text-neutral-800">
                <Fila etiqueta="Debía haber" valor={dinero(k.esperado)} />
                <Fila etiqueta="Contó el cajero" valor={dinero(corte.contado)} />
                <Fila etiqueta="Dejó para mañana" valor={dinero(corte.dejado)} />
                <Fila etiqueta="Debía entregar" valor={dinero(debiaEntregar)} />
                <Fila etiqueta="Entregó a los dueños" valor={dinero(corte.entregado)} fuerte />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}