import { useEffect, useState } from 'react';
import { describirPago, ETIQUETA_SITUACION_COBRO } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearFechaHora, formatearMoneda } from '../../../utils/formato.js';
import * as svc from '../../../services/reportes.service.js';
import Boton from '../../shared/Boton.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const LIMITE = 10;
const SIN_DATO = '—';

// Gris si se canceló, ámbar si todavía debe, verde si ya quedó pagada
function colorSituacion(x) {
  if (x.situacion === 'cancelada') return 'bg-neutral-100 text-neutral-500';
  if (x.pendiente > 0) return 'bg-amber-50 text-amber-800';
  return 'bg-emerald-50 text-emerald-700';
}

function Dato({ titulo, children, clase = '' }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{titulo}</p>
      <p className={`text-sm ${clase}`}>{children}</p>
    </div>
  );
}

// Notas creadas antes del periodo que recibieron pagos dentro del periodo
export default function CobrosAnteriores({ consulta, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const fecha = (iso, zona) => (iso ? formatearFechaHora(iso, zona) : SIN_DATO);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    svc
      .cobrosAnteriores({ ...consulta, limite: LIMITE, pagina })
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [consulta, pagina]);

  if (error) {
    return (
      <div className="max-w-xl">
        <MensajeError error={error} />
      </div>
    );
  }
  if (!datos || datos.total === 0) return null;

  const r = datos.resumen;
  const totalPaginas = Math.max(1, Math.ceil(datos.total / LIMITE));

  return (
    <section id="cobros-anteriores" className="scroll-mt-4 rounded-3xl bg-white border border-[var(--c-borde)] overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[var(--c-borde)]">
        <h3 className="font-semibold tracking-tight">Cobros de notas de días anteriores</h3>
        <p className="text-xs text-neutral-500">
          {r.notas} {r.notas === 1 ? 'nota' : 'notas'} · {r.liquidadas} {r.liquidadas === 1 ? 'liquidada' : 'liquidadas'} · {dinero(r.monto)} (ya va
          dentro de "Dinero que entró")
        </p>
      </div>

      <div className={`grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-3 transition ${cargando ? 'opacity-60' : ''}`}>
        {datos.datos.map((x) => (
          <article key={x.id ?? x.folio} className="rounded-2xl border border-[var(--c-borde)] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={() => x.id && onAbrir(x.id)} className="font-semibold underline-offset-2 hover:underline">
                  {x.folio}
                </button>
                <p className="text-sm text-neutral-600 truncate">{x.cliente ?? 'Sin cliente'}</p>
                {x.sucursal && <p className="text-xs text-neutral-400">{x.sucursal}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${colorSituacion(x)}`}>
                {ETIQUETA_SITUACION_COBRO[x.situacion] ?? x.situacion}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Dato titulo="Dejó la nota">{fecha(x.fecha, x.zonaHoraria)}</Dato>
              <Dato titulo="Total de la nota">{dinero(x.total)}</Dato>
              <Dato titulo="Primer pago">{dinero(x.primerPago.monto)}</Dato>
              <Dato titulo="Cómo pagó">{describirPago(x.primerPago, dinero)}</Dato>
            </div>

            <div className="rounded-xl bg-[#faf8f3] p-3 grid grid-cols-2 gap-3">
              <Dato titulo="Cobrado en el periodo" clase="font-semibold">
                {dinero(x.cobrado.monto)}
              </Dato>
              <Dato titulo="Fecha del cobro">{fecha(x.cobrado.fecha, x.zonaHoraria)}</Dato>
              <div className="col-span-2">
                <Dato titulo="Cómo pagó">{describirPago(x.cobrado, dinero)}</Dato>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Dato titulo="Todavía debe" clase={x.pendiente > 0 ? 'text-amber-700 font-medium' : ''}>
                {dinero(x.pendiente)}
              </Dato>
              <Dato titulo="Última entrega">{fecha(x.entregada, x.zonaHoraria)}</Dato>
            </div>
          </article>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-[var(--c-borde)]">
          <Boton compacto variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Boton>
          <span className="text-sm text-neutral-500">
            {pagina} de {totalPaginas}
          </span>
          <Boton compacto variante="secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </Boton>
        </div>
      )}
    </section>
  );
}