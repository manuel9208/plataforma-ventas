import { useState } from 'react';
import { sumarDias } from '@plataforma/calculos';
import * as svc from '../../services/notas.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda, hoyISO } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const fechaDe = (f) => (f ? String(f).slice(0, 10) : '');
const dosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// servicios: los de la nota que se cotizan (pendientes o ya cotizados que se reajustan)
export default function ModalCotizar({ nota, servicios, onListo, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const hoy = hoyISO();
  const limite = sumarDias(hoy, 365);

  const [filas, setFilas] = useState(() =>
    Object.fromEntries(
      servicios.map((s) => [
        s.partidaId,
        {
          precio: s.porCotizar ? '' : String(Number((s.total - (s.cargoFinanciamiento ?? 0)).toFixed(2))),
          fecha: s.porCotizar ? hoy : fechaDe(s.fechaPrometida) || hoy,
        },
      ])
    )
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const poner = (id, cambios) => setFilas((f) => ({ ...f, [id]: { ...f[id], ...cambios } }));

  const problemaDe = (s) => {
    const f = filas[s.partidaId];
    const n = Number(f.precio);
    if (f.precio === '' || !(n > 0)) return 'Escribe el precio';
    if (n > 99999.99 || !dosDecimales(n)) return 'Precio inválido (máximo 2 decimales)';
    if (!f.fecha) return 'Elige la fecha';
    if (f.fecha !== fechaDe(s.fechaPrometida) && f.fecha < hoy) return 'La fecha no puede ser anterior a hoy';
    if (f.fecha > limite) return 'La fecha está demasiado lejos';
    return '';
  };
  const listo = servicios.every((s) => !problemaDe(s));

  const guardar = async (e) => {
    e.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true);
    setError('');
    try {
      await svc.cotizar(nota.id, {
        servicios: servicios.map((s) => ({ partidaId: s.partidaId, precio: Number(filas[s.partidaId].precio), fechaPrometida: filas[s.partidaId].fecha })),
      });
      onListo();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const reajuste = servicios.every((s) => !s.porCotizar);

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={reajuste ? 'Reajustar cotización' : 'Cotizar servicios'}
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-cotizar" className="flex-1" disabled={!listo} cargando={enviando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-cotizar" onSubmit={guardar} className="space-y-4">
        <p className="text-sm text-neutral-500">Escribe el precio final y la fecha de entrega definitiva. El IVA y el total de la nota se recalculan solos.</p>
        {servicios.map((s) => {
          const datos = Object.values(s.articulo).join(' · ');
          const f = filas[s.partidaId];
          return (
            <div key={s.partidaId} className="rounded-2xl border border-[var(--c-borde)] bg-[#faf8f3] p-4 space-y-3">
              <div>
                <p className="font-medium">{s.nombre}</p>
                {datos && <p className="text-xs text-neutral-500">{datos}</p>}
                {!s.porCotizar && <p className="text-xs text-neutral-400">Precio actual {dinero(s.total - (s.cargoFinanciamiento ?? 0))}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  etiqueta="Precio final *"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={f.precio}
                  onChange={(e) => poner(s.partidaId, { precio: e.target.value })}
                />
                <Campo
                  etiqueta="Fecha de entrega *"
                  type="date"
                  min={hoy}
                  max={limite}
                  value={f.fecha}
                  onChange={(e) => e.target.value && poner(s.partidaId, { fecha: e.target.value })}
                />
              </div>
              {f.precio !== '' && problemaDe(s) && <p className="text-xs text-red-600">{problemaDe(s)}</p>}
            </div>
          );
        })}
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}