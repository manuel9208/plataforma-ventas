import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import SeccionSucursal from './SeccionSucursal.jsx';
import TarjetaAjustes from './TarjetaAjustes.jsx';
import { useConfiguracion } from './useConfiguracion.js';

const claseSelect =
  'w-full max-w-sm min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

export default function AdminConfiguracion() {
  const c = useConfiguracion();
  const d = c.datos;
  const enSucursal = Boolean(d?.alcance);

  return (
    <>
      <EncabezadoApp titulo="Configuración" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-24">
        {c.cargando && !d ? (
          <p className="text-neutral-400">Cargando…</p>
        ) : !d ? (
          <div className="max-w-xl">{c.error && <MensajeError error={c.error} />}</div>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-500 max-w-2xl">
              Aquí decides cómo funciona tu negocio. Lo que cambies para toda la empresa lo usan todas las sucursales, salvo las que tengan un ajuste propio.
            </p>

            <label className="block mb-5">
              <span className="block text-sm font-medium text-neutral-600 mb-1.5">Aplica a</span>
              <select
                value={d.alcance ?? ''}
                onChange={(e) => c.cambiarAlcance(e.target.value ? Number(e.target.value) : null)}
                className={claseSelect}
              >
                {d.puedeElegirEmpresa && <option value="">Toda la empresa</option>}
                {d.sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {!d.puedeElegirEmpresa && (
                <span className="block text-xs text-neutral-500 mt-1">
                  Para cambiar los ajustes de toda la empresa necesitas acceso a todas las sucursales.
                </span>
              )}
            </label>

            {c.error && (
              <div className="mb-4 max-w-xl">
                <MensajeError error={c.error} />
              </div>
            )}

            <div className={`transition ${c.cargando ? 'opacity-60' : ''}`}>
              {d.sucursal && (
                // La clave incluye lo guardado: si el servidor cambia algo, el formulario se reinicia con lo nuevo
                <SeccionSucursal
                  key={`${d.sucursal.id}|${d.sucursal.nombre}|${d.sucursal.telefono}|${d.sucursal.direccion}|${d.sucursal.zonaHoraria}|${d.sucursal.lat}|${d.sucursal.lon}|${d.sucursal.esPrincipal}|${d.sucursal.referencias}|${d.sucursal.mapaUrl}`}
                  s={d.sucursal}
                  puedeCambiarPrincipal={d.puedeCambiarPrincipal}
                  onGuardar={c.guardarSucursal}
                />
              )}

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {d.grupos.map((g) => (
                  <TarjetaAjustes
                    key={`${g.id}|${d.alcance}|${g.ajustes.map((a) => `${a.valor}${a.propio}`).join(',')}`}
                    grupo={g}
                    enSucursal={enSucursal}
                    puedeEditar={d.puedeEditar}
                    variablesPie={d.variablesPie}
                    onGuardar={c.guardarAjustes}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </>
  );
}