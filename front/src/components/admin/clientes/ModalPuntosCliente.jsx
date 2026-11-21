import { useEffect, useRef, useState } from 'react';
import * as svc from '../../../services/clientes.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { tienePermiso } from '../../../utils/permisos.js';
import { nuevoUuid } from '../../../utils/uuid.js';
import { formatearFechaLarga, formatearMoneda } from '../../../utils/formato.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import ListaMovimientosPuntos from '../../shared/ListaMovimientosPuntos.jsx';

const SIGNOS = [
  { id: 'regalar', nombre: 'Regalar' },
  { id: 'quitar', nombre: 'Quitar' },
];

export default function ModalPuntosCliente({ cliente, onCerrar }) {
  const { empresa, usuario } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const puedeAjustar = usuario.rol !== 'adminglobal' && tienePermiso(usuario.permisos, 'puntos.ajustar');

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [signo, setSigno] = useState('regalar');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorAjuste, setErrorAjuste] = useState('');
  const [repetido, setRepetido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // El id se conserva si hay que reintentar por una falla de señal; cambia si se cambian los datos
  const idAjuste = useRef(nuevoUuid());
  const cambiando = (fn) => (v) => {
    idAjuste.current = nuevoUuid();
    fn(v);
  };

  useEffect(() => {
    let vivo = true;
    svc
      .puntos(cliente.id)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [cliente.id]);

  const n = Number(cantidad);
  const valida =
    Number.isInteger(n) && n > 0 && n <= 100000 && motivo.trim().length >= 3 && (signo === 'regalar' || n <= (datos?.saldo ?? 0));

  const guardar = async (e) => {
    e.preventDefault();
    if (!valida) return;
    setEnviando(true);
    setErrorAjuste('');
    try {
      const r = await svc.ajustarPuntos(cliente.id, { id: idAjuste.current, puntos: signo === 'quitar' ? -n : n, motivo: motivo.trim() });
      setDatos(r);
      setRepetido(Boolean(r.repetido));
      idAjuste.current = nuevoUuid();
      setCantidad('');
      setMotivo('');
      setAbierto(false);
    } catch (err) {
      setErrorAjuste(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={`Puntos de ${cliente.nombre}`}
      onCerrar={onCerrar}
      pie={
        <Boton className="flex-1" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="space-y-5">
        {error && <MensajeError error={error} />}
        {!datos && !error && <p className="text-center text-neutral-400 py-6">Cargando…</p>}

        {datos && (
          <>
            <div className="text-center rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-5">
              <p className="text-sm text-neutral-500">Puntos disponibles</p>
              <p className="text-5xl font-semibold tracking-tight">{datos.saldo}</p>
              <p className="text-sm text-neutral-500 mt-1">
                Equivalen a {dinero(datos.valor)} · 1 punto = {dinero(datos.valorPunto)}
              </p>
              {datos.porVencer && (
                <p className="text-xs text-amber-700 mt-2">
                  {datos.porVencer.puntos} {datos.porVencer.puntos === 1 ? 'punto vence' : 'puntos vencen'} el {formatearFechaLarga(datos.porVencer.fecha)}
                </p>
              )}
            </div>

            {!datos.activo && (
              <p className="text-sm rounded-xl bg-amber-50 text-amber-800 px-4 py-3">
                Los puntos están apagados (o el módulo de Promociones no está encendido). Aquí se ve lo que el cliente ya tenía.
              </p>
            )}
            {!cliente.perfil.completo && (
              <p className="text-sm rounded-xl bg-amber-50 text-amber-800 px-4 py-3">
                Este cliente todavía no gana puntos. Falta: {cliente.perfil.falta.join(', ')}.
              </p>
            )}

            {puedeAjustar && !abierto && (
              <Boton variante="secundario" className="w-full" onClick={() => setAbierto(true)}>
                Regalar o quitar puntos
              </Boton>
            )}

            {abierto && (
              <form onSubmit={guardar} className="rounded-2xl border border-[var(--c-borde)] p-4 space-y-4">
                <Segmentos opciones={SIGNOS} valor={signo} onCambio={cambiando(setSigno)} />
                <Campo
                  etiqueta="¿Cuántos puntos?"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => cambiando(setCantidad)(e.target.value)}
                  ayuda={signo === 'quitar' ? `Tiene ${datos.saldo} puntos.` : 'Números enteros.'}
                />
                <Campo
                  etiqueta="Motivo *"
                  value={motivo}
                  onChange={(e) => cambiando(setMotivo)(e.target.value)}
                  maxLength={200}
                  ayuda="Queda registrado. El cliente no lo ve."
                />
                <MensajeError error={errorAjuste} />
                <div className="flex gap-2">
                  <Boton variante="secundario" className="flex-1" onClick={() => setAbierto(false)}>
                    Cancelar
                  </Boton>
                  <Boton type="submit" className="flex-1" disabled={!valida} cargando={enviando}>
                    Guardar
                  </Boton>
                </div>
              </form>
            )}
            {repetido && <p className="text-xs text-neutral-400 text-center">Ese ajuste ya estaba registrado; no se hizo de nuevo.</p>}

            <div>
              <h3 className="font-semibold tracking-tight mb-1">Movimientos</h3>
              <ListaMovimientosPuntos movimientos={datos.movimientos} verMotivo />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}