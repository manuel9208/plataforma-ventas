import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import MensajeError from '../../shared/MensajeError.jsx';
import BloqueAnalisis, { Barra, Tarjeta, Vacio } from './BloqueAnalisis.jsx';
import { PorEmpleado, PorDiaSemana } from './AnalisisPersonas.jsx';
import { Cancelaciones, Cobranza, Descuentos } from './AnalisisDinero.jsx';
import { useAnalisisVentas } from './useAnalisisVentas.js';

function Clientes({ clientes }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const partes = [
    { id: 'nuevos', titulo: 'Clientes nuevos', n: clientes.nuevos.clientes, unidad: 'cliente', vendido: clientes.nuevos.vendido, color: '#059669' },
    { id: 'recurrentes', titulo: 'Clientes que regresan', n: clientes.recurrentes.clientes, unidad: 'cliente', vendido: clientes.recurrentes.vendido, color: '#1d2b4f' },
    { id: 'sin', titulo: 'Sin cliente registrado', n: clientes.sinCliente.ventas, unidad: 'venta', vendido: clientes.sinCliente.vendido, color: '#a3a3a3' },
  ];
  const total = partes.reduce((s, p) => s + p.vendido, 0);

  return (
    <BloqueAnalisis titulo="Clientes" nota="Nuevo es quien se registró dentro del periodo. Las ventas sin cliente son compras de mostrador sin registrar a nadie.">
      {total === 0 ? (
        <Vacio>No hubo ventas en este periodo.</Vacio>
      ) : (
        <ul className="space-y-3">
          {partes.map((p) => {
            const pct = total > 0 ? Math.round((p.vendido * 1000) / total) / 10 : 0;
            return (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p className="font-medium">{p.titulo}</p>
                  <p className="font-semibold">{dinero(p.vendido)}</p>
                </div>
                <Barra porcentaje={pct} color={p.color} />
                <p className="mt-1 text-xs text-neutral-500">
                  {p.n} {p.n === 1 ? p.unidad : `${p.unidad}s`} · {pct}% de lo vendido
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </BloqueAnalisis>
  );
}

// consulta: los filtros del reporte · onAbrir(id) abre el detalle de una nota
export default function AnalisisVentas({ consulta, esLimpieza, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const { datos, error, cargando } = useAnalisisVentas(consulta);
  if (!consulta) return null;

  return (
    <section className="space-y-4 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Para decidir mejor</h2>
        <p className="text-sm text-neutral-500">Quién vende, cuándo, a quién y cuánto se debe. Respeta los filtros de arriba, menos la cobranza.</p>
      </div>

      {error && (
        <div className="max-w-xl">
          <MensajeError error={error} />
        </div>
      )}
      {!datos && cargando && <p className="text-neutral-400">Calculando…</p>}

      {datos && (
        <div className={`space-y-4 transition ${cargando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta titulo="Notas y ventas" valor={datos.resumen.vigentes} nota="Las que siguen vigentes" />
            <Tarjeta titulo="Ticket promedio" valor={dinero(datos.resumen.ticketPromedio)} nota="Lo que deja cada nota o venta" />
            <Tarjeta
              titulo="Canceladas"
              valor={datos.resumen.canceladas}
              nota={datos.resumen.notas > 0 ? `De ${datos.resumen.notas} levantadas` : 'Ninguna en el periodo'}
              clase={datos.resumen.canceladas > 0 ? 'text-red-700' : ''}
            />
            {esLimpieza && (
              <Tarjeta
                titulo="Por cobrar hoy"
                valor={dinero(datos.cobranza.monto)}
                nota="Lo que se debe ahora, sin importar el periodo"
                clase={datos.cobranza.monto > 0 ? 'text-amber-700' : ''}
              />
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PorEmpleado empleados={datos.empleados} />
            <PorDiaSemana diasSemana={datos.diasSemana} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Clientes clientes={datos.clientes} />
            <Descuentos descuentos={datos.descuentos} />
          </div>

          <Cancelaciones cancelaciones={datos.cancelaciones} esLimpieza={esLimpieza} />
          {esLimpieza && <Cobranza cobranza={datos.cobranza} onAbrir={onAbrir} />}
        </div>
      )}
    </section>
  );
}