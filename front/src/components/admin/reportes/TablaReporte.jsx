import { ETIQUETA_ESTADO_NOTA, ORDENES_REPORTE } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda, formatearTelefono } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';

const ORDENABLES = new Set(ORDENES_REPORTE);
const SIN_DATO = '—';

function textoCelda(c, f, dinero) {
  const v = f[c.id];
  if (c.tipo === 'dinero') return v === null || v === undefined ? SIN_DATO : dinero(v);
  if (c.tipo === 'fecha') return formatearFechaHora(f.fecha, f.zonaHoraria);
  if (c.tipo === 'dia') return v ? formatearFechaLarga(v) : SIN_DATO;
  if (c.id === 'estado') return ETIQUETA_ESTADO_NOTA[v] ?? v;
  if (c.id === 'telefono') return v ? formatearTelefono(v) : SIN_DATO;
  if (c.id === 'cliente') return v ?? 'Sin cliente';
  return v ?? SIN_DATO;
}

function claseCelda(c, f) {
  if (f.estado === 'cancelada') return 'text-neutral-400';
  if (c.id === 'pendiente' && f.pendiente > 0) return 'text-amber-700 font-medium';
  if (c.id === 'folio') return 'font-medium';
  return '';
}

export default function TablaReporte({ columnas, filas, total, pagina, limite, orden, direccion, onOrden, onPagina, onColumnas, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-[var(--c-borde)]">
        <div>
          <h3 className="font-semibold tracking-tight">Notas y ventas</h3>
          <p className="text-xs text-neutral-500">
            {total} {total === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        <Boton compacto variante="secundario" onClick={onColumnas}>
          Columnas
        </Boton>
      </div>

      {filas.length === 0 ? (
        <p className="p-8 text-center text-neutral-500">No hay notas ni ventas con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 bg-[#faf8f3]">
                {columnas.map((c) => (
                  <th key={c.id} className={`px-4 py-3 font-medium whitespace-nowrap ${c.tipo === 'dinero' ? 'text-right' : ''}`}>
                    {ORDENABLES.has(c.id) ? (
                      <button type="button" onClick={() => onOrden(c.id)} className="inline-flex items-center gap-1 hover:text-neutral-900">
                        {c.etiqueta}
                        {orden === c.id && <span aria-hidden="true">{direccion === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    ) : (
                      c.etiqueta
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} onClick={() => onAbrir(f.id)} className="border-t border-[var(--c-borde)] cursor-pointer hover:bg-[#fbfaf6]">
                  {columnas.map((c) => (
                    <td
                      key={c.id}
                      className={`px-4 py-3 ${c.id === 'articulos' ? 'whitespace-normal min-w-[16rem] text-neutral-600' : 'whitespace-nowrap'} ${
                        c.tipo === 'dinero' ? 'text-right' : ''
                      } ${claseCelda(c, f)}`}
                    >
                      {c.id === 'folio' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAbrir(f.id);
                          }}
                          className="underline-offset-2 hover:underline"
                        >
                          {textoCelda(c, f, dinero)}
                        </button>
                      ) : (
                        textoCelda(c, f, dinero)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-[var(--c-borde)]">
          <Boton compacto variante="secundario" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
            Anterior
          </Boton>
          <span className="text-sm text-neutral-500">
            {pagina} de {totalPaginas}
          </span>
          <Boton compacto variante="secundario" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
            Siguiente
          </Boton>
        </div>
      )}
    </section>
  );
}