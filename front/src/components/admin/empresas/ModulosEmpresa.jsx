import { formatearMoneda } from '../../../utils/formato.js';
import MensajeError from '../../shared/MensajeError.jsx';
import TarjetaModulo from './TarjetaModulo.jsx';
import { useModulos } from './useModulos.js';

export default function ModulosEmpresa({ empresa }) {
  const lista = useModulos(empresa.id);
  const d = lista.datos;
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  if (lista.cargando && !d) return <p className="text-neutral-400">Cargando…</p>;
  if (!d) return <div className="max-w-xl">{lista.error && <MensajeError error={lista.error} />}</div>;

  const cobrados = d.modulos.filter((m) => m.funcionando && m.costo > 0);

  return (
    <section>
      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 sm:p-6 mb-5">
        <p className="text-sm text-neutral-500">Total mensual de {empresa.nombre}</p>
        <p className="text-4xl font-semibold tracking-tight mt-1">{dinero(d.totalMensual)}</p>
        {cobrados.length > 0 ? (
          <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 text-sm text-neutral-600">
            {cobrados.map((m) => (
              <li key={m.clave} className="flex justify-between gap-3">
                <span className="truncate">{m.nombre}</span>
                <span className="shrink-0 font-medium text-neutral-900">{dinero(m.costo)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Todavía no hay precios capturados. Escribe el precio de cada módulo y guarda.</p>
        )}
        <p className="mt-4 text-xs text-neutral-400">
          Los módulos que cobras por sucursal se multiplican por las {d.sucursales} {d.sucursales === 1 ? 'sucursal activa' : 'sucursales activas'}.
        </p>
      </div>

      {lista.error && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={lista.error} />
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {d.modulos.map((m) => (
          // La clave incluye lo guardado: si el servidor cambia algo, la tarjeta se reinicia con lo nuevo
          <TarjetaModulo
            key={`${m.clave}|${m.activo}|${m.precioPropio}|${m.venceEn}|${m.nota}`}
            modulo={m}
            sucursales={d.sucursales}
            moneda={empresa.moneda}
            onGuardar={lista.guardar}
          />
        ))}
      </ul>
    </section>
  );
}