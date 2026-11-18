import { useMemo, useRef, useState } from 'react';
import { planCancelacion } from '@plataforma/calculos';
import * as svc from '../../services/notas.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { autorizacionLista, cuerpoAutorizacion } from '../../utils/autorizacion.js';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import CamposAutorizacion from './CamposAutorizacion.jsx';
import CamposDevolucion from './CamposDevolucion.jsx';
import { PENDIENTE, dosDecimales, sumar } from './ajustes.js';

// Cancela servicios En espera (con sus extras) y/o devuelve productos. El servidor recalcula todo.
export default function ModalCancelar({ nota, onListo, onCerrar }) {
  const { usuario, empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const puedeAutorizar = tienePermiso(usuario.permisos, 'notas.cancelar');

  const servicios = nota.servicios.filter((s) => PENDIENTE.includes(s.estado));
  const productos = nota.productos.filter((p) => !p.devuelto);

  const [elegidos, setElegidos] = useState([]);
  const [devolverTexto, setDevolverTexto] = useState(null); // null = se devuelve todo lo posible
  const [forma, setForma] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [auth, setAuth] = useState({ pin: '', telefono: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se cancela dos veces
  const idOperacion = useRef(nuevoUuid());

  const alternar = (id) => {
    setDevolverTexto(null);
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  };

  const { plan, problema } = useMemo(() => {
    if (!elegidos.length) return { plan: null, problema: '' };
    const sumaServicios = sumar(servicios.filter((s) => elegidos.includes(s.partidaId)).flatMap((s) => [s.total, ...s.extras.map((x) => x.total)]));
    const sumaProductos = sumar(productos.filter((p) => elegidos.includes(p.partidaId)).map((p) => p.total));
    try {
      const maximo = planCancelacion(nota.valores, { productos: sumaProductos, servicios: sumaServicios }, 0);
      const quiere = devolverTexto === null ? maximo.tope : Number(devolverTexto);
      if (Number.isNaN(quiere)) return { plan: { ...maximo, devuelto: 0 }, problema: 'Escribe un monto válido' };
      return { plan: planCancelacion(nota.valores, { productos: sumaProductos, servicios: sumaServicios }, dosDecimales(quiere)), problema: '' };
    } catch (e) {
      return { plan: null, problema: e.message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegidos, devolverTexto, nota]);

  const conDinero = !!plan && plan.devuelto > 0;
  const completo =
    !!plan && motivo.trim().length >= 3 && autorizacionLista(auth, puedeAutorizar) && !enviando;

  const cancelar = async (e) => {
    e.preventDefault();
    if (!completo) return;
    setEnviando(true);
    setError('');
    try {
      const r = await svc.cancelar(nota.id, {
        id: idOperacion.current,
        partidaIds: elegidos,
        devolver: plan.devuelto,
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

  const vacio = !servicios.length && !productos.length;

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Cancelar artículos"
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton type="submit" form="form-cancelar" variante="peligro" className="flex-1" disabled={!completo} cargando={enviando}>
            Cancelar
          </Boton>
        </>
      }
    >
      <form id="form-cancelar" onSubmit={cancelar} className="space-y-5">
        {vacio ? (
          <p className="text-neutral-500">No hay nada que cancelar. Un trabajo Listo o Entregado solo admite reembolso.</p>
        ) : (
          <>
            <fieldset>
              <legend className="text-sm font-medium text-neutral-600 mb-2">¿Qué se cancela?</legend>
              <div className="space-y-2">
                {servicios.map((s) => {
                  const datos = Object.values(s.articulo).join(' · ');
                  return (
                    <label key={s.partidaId} className="flex items-start gap-3 rounded-2xl border border-[var(--c-borde)] bg-[#faf8f3] p-3 min-h-14">
                      <input type="checkbox" className="size-5 mt-0.5 accent-[var(--c-primario)]" checked={elegidos.includes(s.partidaId)} onChange={() => alternar(s.partidaId)} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.nombre}</span>
                        {datos && <span className="block text-xs text-neutral-500">{datos}</span>}
                        {s.extras.length > 0 && <span className="block text-xs text-neutral-500">+ {s.extras.map((x) => x.nombre).join(', ')}</span>}
                      </span>
                      <span className="font-medium shrink-0">{dinero(sumar([s.total, ...s.extras.map((x) => x.total)]))}</span>
                    </label>
                  );
                })}
                {productos.map((p) => (
                  <label key={p.partidaId} className="flex items-start gap-3 rounded-2xl border border-[var(--c-borde)] bg-[#faf8f3] p-3 min-h-14">
                    <input type="checkbox" className="size-5 mt-0.5 accent-[var(--c-primario)]" checked={elegidos.includes(p.partidaId)} onChange={() => alternar(p.partidaId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.nombre}</span>
                      <span className="block text-xs text-neutral-500">Producto · se devuelve</span>
                    </span>
                    <span className="font-medium shrink-0">{dinero(p.total)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {plan && (
              <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Se cancela</span>
                  <span className="font-semibold">{dinero(plan.cancelado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">El cliente tiene pagado de más</span>
                  <span className="font-semibold">{dinero(plan.tope)}</span>
                </div>
                {plan.tope > 0 ? (
                  <>
                    <Campo
                      etiqueta="¿Cuánto se devuelve?"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max={plan.tope}
                      value={devolverTexto ?? String(plan.tope)}
                      onChange={(e) => setDevolverTexto(e.target.value)}
                      ayuda={plan.retenido > 0 ? `Quedan ${dinero(plan.retenido)} retenidos por el trabajo ya hecho.` : 'Se devuelve todo lo pagado.'}
                    />
                  </>
                ) : (
                  <p className="text-neutral-500">El cliente no tiene dinero de más: no hay nada que devolver.</p>
                )}
              </div>
            )}
            {problema && <p className="text-sm text-red-600">{problema}</p>}

            {elegidos.length > 0 && (
              <>
                <CamposDevolucion
                  conDinero={conDinero}
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