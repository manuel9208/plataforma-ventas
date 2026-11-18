import { useMemo, useRef, useState } from 'react';
import { nombreUnidad, planDevolucionVenta } from '@plataforma/calculos';
import * as svc from '../../services/ventasMostrador.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { autorizacionLista, cuerpoAutorizacion } from '../../utils/autorizacion.js';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import CamposAutorizacion from './CamposAutorizacion.jsx';
import CamposDevolucion from './CamposDevolucion.jsx';

// Devolución de productos por cantidad. El servidor vuelve a calcular todo.
export default function ModalDevolver({ venta, onListo, onCerrar }) {
  const { usuario, empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const puedeAutorizar = tienePermiso(usuario.permisos, 'notas.cancelar');

  const disponibles = venta.productos.filter((p) => p.disponible > 0);
  const [cantidades, setCantidades] = useState({}); // partidaId -> texto
  const [forma, setForma] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [auth, setAuth] = useState({ pin: '', telefono: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se devuelve dos veces
  const idOperacion = useRef(nuevoUuid());

  const poner = (id, valor) => setCantidades((c) => ({ ...c, [id]: valor }));

  const lineas = useMemo(
    () =>
      disponibles
        .map((p) => ({ partidaId: p.partidaId, cantidad: Number(cantidades[p.partidaId] || 0) }))
        .filter((l) => l.cantidad > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cantidades, venta]
  );

  const { plan, problema } = useMemo(() => {
    if (!lineas.length) return { plan: null, problema: '' };
    try {
      const datosNota = {
        total: venta.total,
        cancelado: venta.devuelto,
        ajustado: 0,
        retenido: 0,
        reembolsado: venta.devuelto,
        cobrado: venta.pagos.reduce((s, p) => s + p.monto, 0),
        productosVigentes: venta.productos.reduce((s, p) => s + (p.total - p.valorDevuelto), 0),
        serviciosVigentes: 0,
        serviciosHechos: 0,
      };
      const partidas = venta.productos.map((p) => ({
        id: p.partidaId,
        tipo: 'producto',
        nombre: p.nombre,
        unidad: p.unidad,
        cantidad: p.cantidad,
        cantidadDevuelta: p.cantidadDevuelta,
        total: p.total,
        valorDevuelto: p.valorDevuelto,
        ajusteId: null,
      }));
      return { plan: planDevolucionVenta(datosNota, partidas, lineas), problema: '' };
    } catch (e) {
      return { plan: null, problema: e.message };
    }
  }, [lineas, venta]);

  const completo = !!plan && motivo.trim().length >= 3 && autorizacionLista(auth, puedeAutorizar) && !enviando;

  const devolver = async (e) => {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setError('');
    try {
      const r = await svc.devolver(venta.id, {
        id: idOperacion.current,
        lineas: lineas.map((l) => ({ partidaId: l.partidaId, cantidad: l.cantidad })),
        ...(plan.devuelto > 0 ? { forma, ...(referencia.trim() ? { referencia: referencia.trim() } : {}) } : {}),
        motivo: motivo.trim(),
        autorizacion: cuerpoAutorizacion(auth, puedeAutorizar),
      });
      onListo(r);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Devolver productos"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton type="submit" form="form-devolver" variante="peligro" className="flex-1" disabled={!completo} cargando={enviando}>
            {plan ? `Devolver ${dinero(plan.devuelto)}` : 'Devolver'}
          </Boton>
        </>
      }
    >
      <form id="form-devolver" onSubmit={devolver} className="space-y-5">
        {disponibles.length === 0 ? (
          <p className="text-neutral-500">Esta venta ya se devolvió por completo.</p>
        ) : (
          <>
            <fieldset>
              <legend className="text-sm font-medium text-neutral-600 mb-2">¿Cuánto se devuelve de cada producto?</legend>
              <div className="space-y-2">
                {disponibles.map((p) => {
                  const valor = cantidades[p.partidaId] ?? '';
                  const unidad = nombreUnidad(p.unidad ?? 'pieza').toLowerCase();
                  return (
                    <div key={p.partidaId} className="rounded-2xl border border-[var(--c-borde)] bg-[#faf8f3] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-neutral-500">
                            Se vendieron {p.cantidad} {unidad} · se pueden devolver {p.disponible}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => poner(p.partidaId, valor === String(p.disponible) ? '' : String(p.disponible))}
                          className="shrink-0 min-h-9 px-3 rounded-lg border border-[var(--c-borde)] bg-white text-xs font-medium"
                        >
                          {valor === String(p.disponible) ? 'Quitar' : 'Todo'}
                        </button>
                      </div>
                      <div className="mt-3">
                        {p.decimales ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min="0"
                            max={p.disponible}
                            value={valor}
                            onChange={(e) => poner(p.partidaId, e.target.value)}
                            placeholder="0"
                            aria-label={`Cantidad a devolver de ${p.nombre}`}
                            className="w-32 min-h-11 px-3 rounded-xl border border-[var(--c-borde)] bg-white outline-none focus:border-[var(--c-acento)]"
                          />
                        ) : (
                          <div className="inline-flex items-center rounded-xl border border-[var(--c-borde)] bg-white">
                            <button
                              type="button"
                              aria-label="Menos"
                              onClick={() => poner(p.partidaId, String(Math.max(Number(valor || 0) - 1, 0)))}
                              className="size-11 text-lg"
                            >
                              −
                            </button>
                            <span className="w-10 text-center font-semibold">{valor || 0}</span>
                            <button
                              type="button"
                              aria-label="Más"
                              onClick={() => poner(p.partidaId, String(Math.min(Number(valor || 0) + 1, p.disponible)))}
                              className="size-11 text-lg"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {plan && (
              <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-1 text-sm">
                {plan.lineas.map((l) => (
                  <div key={l.partidaId} className="flex justify-between text-neutral-600">
                    <span className="truncate">{l.nombre}</span>
                    <span className="shrink-0">{dinero(l.valor)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-neutral-900 pt-2 mt-1 border-t border-[var(--c-borde)]">
                  <span>Se devuelve al cliente</span>
                  <span>{dinero(plan.devuelto)}</span>
                </div>
              </div>
            )}
            {problema && <p className="text-sm text-red-600">{problema}</p>}

            {plan && (
              <>
                <CamposDevolucion
                  conDinero={plan.devuelto > 0}
                  forma={forma}
                  onForma={setForma}
                  referencia={referencia}
                  onReferencia={setReferencia}
                  motivo={motivo}
                  onMotivo={setMotivo}
                />
                <CamposAutorizacion valor={auth} onCambio={setAuth} puedeAutorizar={puedeAutorizar} />
              </>
            )}
          </>
        )}
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}