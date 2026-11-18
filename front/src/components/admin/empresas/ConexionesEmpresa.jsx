import MensajeError from '../../shared/MensajeError.jsx';
import TarjetaConexion from './TarjetaConexion.jsx';
import { useConexiones } from './useConexiones.js';

const claseSelect =
  'w-full max-w-sm min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

export default function ConexionesEmpresa({ empresa }) {
  const c = useConexiones(empresa.id);
  const d = c.datos;

  if (c.cargando && !d) return <p className="text-neutral-400">Cargando…</p>;
  if (!d) return <div className="max-w-xl">{c.error && <MensajeError error={c.error} />}</div>;

  return (
    <section>
      <p className="mb-4 text-sm text-neutral-500 max-w-2xl">
        Aquí capturas las llaves de {empresa.nombre}. Salen enmascaradas y nunca se envían a las pantallas del cliente. WhatsApp y correo pueden tener
        configuración propia por sucursal.
      </p>

      <label className="block mb-5">
        <span className="block text-sm font-medium text-neutral-600 mb-1.5">Aplica a</span>
        <select value={c.alcance ?? ''} onChange={(e) => c.cambiarAlcance(e.target.value ? Number(e.target.value) : null)} className={claseSelect}>
          <option value="">Toda la empresa</option>
          {d.sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      {c.error && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={c.error} />
        </div>
      )}

      <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition ${c.cargando ? 'opacity-60' : ''}`}>
        {d.grupos.map((g) => (
          // La clave incluye lo guardado: si el servidor cambia algo, la tarjeta se reinicia con lo nuevo
          <TarjetaConexion
            key={`${g.grupo}|${d.sucursalId}|${g.propia}|${g.variables.map((v) => `${v.definida}${v.valor ?? v.enmascarado ?? ''}`).join(',')}`}
            g={g}
            enSucursal={Boolean(d.sucursalId)}
            onGuardar={c.guardar}
            onQuitar={c.quitar}
            onRevelar={c.revelar}
          />
        ))}
      </ul>
    </section>
  );
}