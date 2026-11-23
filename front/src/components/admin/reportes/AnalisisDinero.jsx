import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda, formatearTelefono } from '../../../utils/formato.js';
import BloqueAnalisis, { Vacio } from './BloqueAnalisis.jsx';

const COLOR_RANGO = {
  reciente: 'bg-white border-[var(--c-borde)] text-neutral-900',
  media: 'bg-amber-50 border-amber-200 text-amber-800',
  atrasada: 'bg-red-50 border-red-200 text-red-800',
};

export function Cancelaciones({ cancelaciones, esLimpieza }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  // Sin servicios no hay notas que cancelar ni reembolsos
  const categorias = cancelaciones.categorias.filter((c) => esLimpieza || c.id === 'devolucion');

  return (
    <BloqueAnalisis titulo="Cancelaciones y devoluciones" nota="Lo que se canceló, devolvió o reembolsó en el periodo, por la fecha en que se hizo.">
      {cancelaciones.operaciones === 0 ? (
        <Vacio>No hubo cancelaciones ni devoluciones.</Vacio>
      ) : (
        <>
          <ul className="divide-y divide-[var(--c-borde)] text-sm">
            {categorias.map((c) => (
              <li key={c.id} className={`py-2.5 flex items-start justify-between gap-3 ${c.operaciones === 0 ? 'text-neutral-400' : ''}`}>
                <div className="min-w-0">
                  <p className="font-medium">{c.etiqueta}</p>
                  <p className="text-xs text-neutral-500">
                    {c.operaciones} {c.operaciones === 1 ? 'operación' : 'operaciones'}
                    {c.cancelado > 0 ? ` · cancelado ${dinero(c.cancelado)}` : ''}
                    {c.retenido > 0 ? ` · retenido ${dinero(c.retenido)}` : ''}
                  </p>
                </div>
                <p className="font-semibold shrink-0">{c.devuelto > 0 ? `−${dinero(c.devuelto)}` : dinero(0)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 pt-2 border-t border-[var(--c-borde)] flex justify-between text-sm font-semibold">
            <span>Dinero devuelto</span>
            <span>{dinero(cancelaciones.devuelto)}</span>
          </p>

          {cancelaciones.motivos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-neutral-600 mb-1">Motivos que más se repiten</p>
              <ul className="text-sm divide-y divide-[var(--c-borde)]">
                {cancelaciones.motivos.map((m) => (
                  <li key={m.motivo} className="py-1.5 flex justify-between gap-3">
                    <span className="min-w-0 truncate">{m.motivo}</span>
                    <span className="text-neutral-500 shrink-0">
                      {m.veces} {m.veces === 1 ? 'vez' : 'veces'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </BloqueAnalisis>
  );
}

export function Cobranza({ cobranza, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <BloqueAnalisis
      titulo="Cobranza: lo que se debe hoy"
      nota="Es la deuda de hoy, sin importar el periodo que miras. Respeta las sucursales y el empleado elegidos. La antigüedad cuenta desde que se levantó la nota."
    >
      {cobranza.notas === 0 ? (
        <p className="text-sm text-emerald-700">Nadie debe nada. Todas las notas están pagadas.</p>
      ) : (
        <>
          <p className="text-3xl font-semibold tracking-tight text-amber-700">{dinero(cobranza.monto)}</p>
          <p className="text-xs text-neutral-500">
            En {cobranza.notas} {cobranza.notas === 1 ? 'nota' : 'notas'}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {cobranza.rangos.map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 ${COLOR_RANGO[r.id]}`}>
                <p className="text-xs font-medium opacity-80">{r.etiqueta}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">{dinero(r.monto)}</p>
                <p className="text-xs opacity-70">
                  {r.notas} {r.notas === 1 ? 'nota' : 'notas'}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-neutral-600 mb-1">Las notas más atrasadas</p>
          <ul className="divide-y divide-[var(--c-borde)]">
            {cobranza.masAtrasadas.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onAbrir(n.id)} className="w-full text-left py-2.5 flex items-start justify-between gap-3 hover:bg-[#fbfaf6]">
                  <div className="min-w-0">
                    <p className="font-medium">{n.folio}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {n.cliente ?? 'Sin cliente'}
                      {n.telefono ? ` · ${formatearTelefono(n.telefono)}` : ''} · {n.sucursal}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-amber-700">{dinero(n.saldo)}</p>
                    <p className="text-xs text-neutral-500">{n.dias === 0 ? 'de hoy' : `hace ${n.dias} ${n.dias === 1 ? 'día' : 'días'}`}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </BloqueAnalisis>
  );
}

function Lista({ titulo, filas, vacio, dinero }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-600 mb-1">{titulo}</p>
      {filas.length === 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <ul className="text-sm divide-y divide-[var(--c-borde)]">
          {filas.map((f) => (
            <li key={f.nombre} className="py-1.5 flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {f.nombre}
                <span className="text-xs text-neutral-400"> · {f.veces} {f.veces === 1 ? 'artículo' : 'artículos'}</span>
              </span>
              <span className="font-medium shrink-0">{dinero(f.descuento)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Descuentos({ descuentos }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const hay = descuentos.promociones.length > 0 || descuentos.manuales.length > 0;

  return (
    <BloqueAnalisis titulo="Descuentos dados" nota="Lo descontado en lo que sigue vigente. Los manuales muestran quién los autorizó.">
      {!hay ? (
        <Vacio>No se dieron descuentos en este periodo.</Vacio>
      ) : (
        <div className="space-y-4">
          <Lista titulo={`Por promociones · ${dinero(descuentos.totalPromociones)}`} filas={descuentos.promociones} vacio="Ninguna promoción aplicó." dinero={dinero} />
          <Lista titulo={`Descuentos manuales · ${dinero(descuentos.totalManuales)}`} filas={descuentos.manuales} vacio="No hubo descuentos manuales." dinero={dinero} />
        </div>
      )}
    </BloqueAnalisis>
  );
}