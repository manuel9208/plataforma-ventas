import { useEffect, useState } from 'react';
import { ETIQUETA_ESTADO_NOTA, nombreUnidad } from '@plataforma/calculos';
import * as svc from '../../../services/reportes.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda, formatearTelefono } from '../../../utils/formato.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import EtiquetaEstado from '../../caja/EtiquetaEstado.jsx';
import { agruparServicios } from '../../caja/agruparServicios.js';

export default function DetalleVentaReporte({ id, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const [nota, setNota] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    svc
      .detalleVenta(id)
      .then((d) => vivo && setNota(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id]);

  const grupos = nota ? agruparServicios(nota.servicios.filter((s) => !s.quitado || s.estado === 'cancelado')) : [];
  const productos = nota ? nota.productos.filter((p) => !p.quitado) : [];

  return (
    <Modal
      abierto
      ancho="sm:max-w-2xl"
      titulo={nota ? nota.folio : 'Nota'}
      onCerrar={onCerrar}
      pie={
        <Boton className="flex-1" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      {error && <MensajeError error={error} />}
      {!nota && !error && <p className="text-center text-neutral-400 py-6">Cargando…</p>}

      {nota && (
        <div className="space-y-5">
          <div className="text-sm">
            <p className="font-semibold text-base">{nota.cliente ? nota.cliente.nombre : 'Sin cliente'}</p>
            {nota.cliente?.telefono && <p className="text-neutral-500">{formatearTelefono(nota.cliente.telefono)}</p>}
            <p className="text-xs text-neutral-400 mt-1">
              {nota.tipo} · {nota.sucursal} · {nota.cajero} · {formatearFechaHora(nota.fecha, nota.zonaHoraria)}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {ETIQUETA_ESTADO_NOTA[nota.estado] ?? nota.estado} · total {dinero(nota.total)}
            </p>
          </div>

          {grupos.length > 0 && (
            <section>
              <h3 className="font-semibold tracking-tight mb-2">Servicios que consumió</h3>
              <div className="space-y-3">
                {grupos.map((g) => {
                  const datos = Object.values(g.articulo).join(' · ');
                  return (
                    <div key={g.id} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4">
                      {datos && <p className="font-semibold">{datos}</p>}
                      {g.comentario && <p className="text-xs text-neutral-500 italic mt-0.5">Nota interna: {g.comentario}</p>}
                      <ul className={`space-y-2 ${datos || g.comentario ? 'mt-3' : ''}`}>
                        {g.servicios.map((s) => (
                          <li key={s.partidaId} className="rounded-xl bg-white border border-[var(--c-borde)] p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`font-medium ${s.estado === 'cancelado' ? 'line-through text-neutral-400' : ''}`}>{s.nombre}</p>
                              <EtiquetaEstado estado={s.estado} />
                            </div>
                            {s.extras.map((x, i) => (
                              <p key={i} className="text-xs text-neutral-500 mt-0.5">
                                + {x.nombre} · {dinero(x.total)}
                              </p>
                            ))}
                            <p className="mt-1.5 font-semibold">{dinero(s.total)}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {productos.length > 0 && (
            <section>
              <h3 className="font-semibold tracking-tight mb-2">Productos que consumió</h3>
              <ul className="divide-y divide-[var(--c-borde)] text-sm">
                {productos.map((p, i) => (
                  <li key={i} className="py-2 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p>{p.nombre}</p>
                      <p className="text-xs text-neutral-500">
                        {p.cantidad} {nombreUnidad(p.unidad ?? 'pieza').toLowerCase()}
                        {p.devuelta > 0 ? ` · devolvió ${p.devuelta}` : ''}
                      </p>
                    </div>
                    <span className="font-medium shrink-0">{dinero(p.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {grupos.length === 0 && productos.length === 0 && <p className="text-sm text-neutral-400">Esta nota no tiene nada vigente.</p>}
          {nota.cancelado > 0 && <p className="text-xs text-neutral-500">Se canceló o devolvió {dinero(nota.cancelado)} de esta nota. Eso ya no cuenta como consumo.</p>}
        </div>
      )}
    </Modal>
  );
}