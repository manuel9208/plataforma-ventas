import { nombreUnidad } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import MensajeError from '../../shared/MensajeError.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import SinVentas from './SinVentas.jsx';
import { useConsumoVentas } from './useConsumoVentas.js';

const ORDENES = [
  { id: 'cantidad', nombre: 'Más piezas' },
  { id: 'dinero', nombre: 'Más dinero' },
];

const numero = (n) => Number(Number(n).toFixed(3)).toLocaleString('es-MX');

function Barra({ porcentaje }) {
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-[#f3efe6] overflow-hidden" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: '#c9a25c' }} />
    </div>
  );
}

function Bloque({ titulo, resumen, vacio, children }) {
  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold tracking-tight">{titulo}</h3>
        <p className="text-sm text-neutral-500">{resumen}</p>
      </div>
      {vacio ? <p className="mt-3 text-sm text-neutral-400">No hubo nada en este periodo.</p> : <ul className="mt-2 divide-y divide-[var(--c-borde)]">{children}</ul>}
    </section>
  );
}

function Fila({ nombre, detalle, derecha, abajo, porcentaje, children }) {
  const contenido = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{nombre}</p>
        <p className="text-xs text-neutral-500">{detalle}</p>
        <Barra porcentaje={porcentaje} />
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold">{derecha}</p>
        <p className="text-xs text-neutral-500">{abajo}</p>
      </div>
    </div>
  );
  if (!children) return <li className="py-3">{contenido}</li>;
  return (
    <li className="py-3">
      <details>
        <summary className="cursor-pointer list-none">{contenido}</summary>
        <div className="mt-3 rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] px-4 py-2">{children}</div>
      </details>
    </li>
  );
}

export default function ConsumoVentas({ consulta, esLimpieza, onOrden }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { datos, error, cargando } = useConsumoVentas(consulta);
  if (!consulta) return null;

  const conServicios = esLimpieza && consulta.giro !== 'productos';
  const conProductos = consulta.giro !== 'servicios';

  return (
    <section className="space-y-4 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Lo que se consumió</h2>
          <p className="text-sm text-neutral-500">Lo vendido en el periodo, sin lo cancelado ni lo devuelto. Respeta los filtros de arriba.</p>
        </div>
        <Segmentos opciones={ORDENES} valor={consulta.orden} onCambio={onOrden} compacto />
      </div>

      {error && (
        <div className="max-w-xl">
          <MensajeError error={error} />
        </div>
      )}
      {!datos && cargando && <p className="text-neutral-400">Calculando…</p>}

      {datos && (
        <div className={`space-y-4 transition ${cargando ? 'opacity-60' : ''}`}>
          {conServicios && (
            <Bloque
              titulo="Servicios"
              resumen={`${datos.servicios.veces} ${datos.servicios.veces === 1 ? 'servicio hecho' : 'servicios hechos'} · ${dinero(datos.servicios.dinero)}`}
              vacio={datos.servicios.items.length === 0}
            >
              {datos.servicios.items.map((s) => (
                <Fila
                  key={s.id}
                  nombre={s.nombre}
                  detalle={`En ${s.notas} ${s.notas === 1 ? 'nota' : 'notas'} · ${s.porcentaje}% del dinero`}
                  derecha={`${s.cantidad} ${s.cantidad === 1 ? 'vez' : 'veces'}`}
                  abajo={dinero(s.dinero)}
                  porcentaje={s.porcentaje}
                >
                  {s.porTipo.length > 1 || s.porTipo[0]?.tipo ? (
                    <ul className="divide-y divide-[var(--c-borde)] text-sm">
                      {s.porTipo.map((t) => (
                        <li key={t.tipo ?? 'sin'} className="py-2 flex justify-between gap-3">
                          <span>{t.tipo ?? 'Sin tipo'}</span>
                          <span className="text-neutral-600">
                            {t.cantidad} · {dinero(t.dinero)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Fila>
              ))}
            </Bloque>
          )}

          {conProductos && (
            <Bloque titulo="Productos" resumen={`${dinero(datos.productos.dinero)} en total`} vacio={datos.productos.items.length === 0}>
              {datos.productos.items.map((p) => (
                <Fila
                  key={p.id}
                  nombre={p.nombre}
                  detalle={`En ${p.notas} ${p.notas === 1 ? 'venta' : 'ventas'} · ${p.porcentaje}% del dinero`}
                  derecha={`${numero(p.cantidad)} ${nombreUnidad(p.unidad ?? 'pieza').toLowerCase()}`}
                  abajo={dinero(p.dinero)}
                  porcentaje={p.porcentaje}
                />
              ))}
            </Bloque>
          )}

          {conServicios && datos.extras.items.length > 0 && (
            <Bloque titulo="Extras de los servicios" resumen={`${dinero(datos.extras.dinero)} en total`} vacio={false}>
              {datos.extras.items.map((x) => (
                <Fila
                  key={x.id}
                  nombre={x.nombre}
                  detalle={`En ${x.notas} ${x.notas === 1 ? 'nota' : 'notas'}`}
                  derecha={`${x.cantidad} ${x.cantidad === 1 ? 'vez' : 'veces'}`}
                  abajo={dinero(x.dinero)}
                  porcentaje={x.porcentaje}
                />
              ))}
            </Bloque>
          )}

          <SinVentas sinVentas={datos.sinVentas} esLimpieza={esLimpieza} giro={consulta.giro} />
        </div>
      )}
    </section>
  );
}