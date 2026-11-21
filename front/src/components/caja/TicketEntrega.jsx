import { ETIQUETA_METODO, ticketEntregaTermico } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaHora } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import BotonesImpresion from './BotonesImpresion.jsx';
import AvisoPuntos from '../shared/AvisoPuntos.jsx';

// Ticket de entrega. Nunca muestra el PIN.
export default function TicketEntrega({ ticket, onCerrar }) {
  const { empresa } = useAuth();

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Entrega</p>
        <h2 className="text-center text-xl font-semibold tracking-tight mt-1">{ticket.folio}</h2>
        <p className="text-center text-sm text-neutral-500">
          {empresa.nombre} · {ticket.sucursal}
        </p>
        <p className="text-center text-xs text-neutral-400">
          {formatearFechaHora(ticket.entregadaEn, ticket.zonaHoraria)} · {ticket.caja} · {ticket.entrego}
        </p>
        {ticket.cliente && (
          <p className="text-center text-sm text-neutral-600 mt-2">
            {ticket.cliente.nombre} · {ticket.cliente.telefono}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {ticket.articulos.map((a) => {
            const datos = Object.values(a.articulo).join(' · ');
            return (
              <div key={a.partidaId} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-3 text-sm">
                <p className="font-medium">{a.nombre}</p>
                {datos && <p className="text-xs text-neutral-500 mt-0.5">{datos}</p>}
                {a.extras.map((x, i) => (
                  <p key={i} className="text-xs text-neutral-500 mt-0.5">
                    + {x}
                  </p>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] space-y-1 text-sm text-neutral-600">
          {ticket.recoge && (
            <div className="flex justify-between gap-3">
              <span>Recogió</span>
              <span className="font-medium text-neutral-900 text-right">{ticket.recoge}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span>Forma</span>
            <span className="text-right">{ETIQUETA_METODO[ticket.metodo]}</span>
          </div>
          {ticket.autorizo && (
            <div className="flex justify-between gap-3">
              <span>Autorizó</span>
              <span className="text-right">{ticket.autorizo}</span>
            </div>
          )}
          {ticket.motivo && (
            <div className="flex justify-between gap-3">
              <span>Motivo</span>
              <span className="text-right">{ticket.motivo}</span>
            </div>
          )}
        </div>

        {ticket.pendientes > 0 && (
          <div className="mt-4 text-sm">
            <p className="text-center text-amber-700">
              Aún quedan {ticket.pendientes} {ticket.pendientes === 1 ? 'artículo' : 'artículos'} de esta nota por entregar.
            </p>
            {(ticket.faltan ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-neutral-600">
                {ticket.faltan.map((s) => (
                  <li key={s.partidaId} className="rounded-xl bg-[#faf8f3] border border-[var(--c-borde)] px-3 py-2">
                    <span className="font-medium">{s.nombre}</span>
                    <span className="block text-xs text-neutral-500">
                      {Object.values(s.articulo).join(' · ')}
                      {Object.keys(s.articulo).length ? ' · ' : ''}
                      {s.estado === 'listo' ? 'Listo para recoger' : 'En espera'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {ticket.puntos && (
          <div className="mt-4">
            <AvisoPuntos puntos={ticket.puntos} />
          </div>
        )}

        {ticket.pieEntrega && (
          <p className="mt-5 pt-4 border-t border-[var(--c-borde)] text-center text-xs text-neutral-500 whitespace-pre-line">{ticket.pieEntrega}</p>
        )}
      </div>

      {ticket.repetida && <p className="text-center text-xs text-neutral-400">Esta entrega ya estaba registrada; no se entregó de nuevo.</p>}
      <BotonesImpresion
        etiqueta="Imprimir ticket de entrega"
        automatico={!ticket.repetida}
        armar={({ impresion, empresa, fmt }) => [
          ticketEntregaTermico(ticket, { ancho: impresion.anchoPapel, corte: impresion.corteAutomatico, empresa: empresa.nombre, fmt }),
        ]}
      />
      <Boton className="w-full" onClick={onCerrar}>
        Listo
      </Boton>
    </div>
  );
}