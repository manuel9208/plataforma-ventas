import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import TarjetaVenta from './TarjetaVenta.jsx';

export default function ListaVentas({ lista, onAbrir }) {
  const hayFiltros = lista.consulta || lista.desde || lista.hasta;

  return (
    <section>
      <p className="mb-3 text-sm text-neutral-500">
        {lista.verTodas ? 'Aquí ves todas las ventas de productos de tus sucursales.' : 'Aquí ves las ventas de productos de tu turno actual.'}
      </p>

      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icono nombre="buscar" className="size-5" />
        </span>
        <input
          value={lista.buscar}
          onChange={(e) => lista.setBuscar(e.target.value)}
          placeholder="Busca por folio, teléfono o nombre"
          className="w-full min-h-12 pl-12 pr-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
        />
      </div>

      {lista.verTodas && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-xl mb-4">
          <Campo etiqueta="Desde" type="date" value={lista.desde} max={lista.hasta || undefined} onChange={(e) => lista.cambiarDesde(e.target.value)} />
          <Campo etiqueta="Hasta" type="date" value={lista.hasta} min={lista.desde || undefined} onChange={(e) => lista.cambiarHasta(e.target.value)} />
        </div>
      )}

      {lista.error && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={lista.error} />
        </div>
      )}

      {lista.cargando && !lista.datos.length ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : !lista.datos.length ? (
        !lista.error && (
          <p className="text-neutral-500">
            {hayFiltros ? 'No encontramos ventas con esos datos.' : lista.verTodas ? 'Aún no hay ventas de productos.' : 'Aún no hay ventas en tu turno.'}
          </p>
        )
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition ${lista.refrescando ? 'opacity-60' : ''}`}>
          {lista.datos.map((v) => (
            <TarjetaVenta key={v.id} venta={v} verTodas={lista.verTodas} onAbrir={onAbrir} />
          ))}
        </div>
      )}

      {lista.hayMas && (
        <div className="mt-6 flex justify-center">
          <Boton variante="secundario" cargando={lista.cargandoMas} onClick={lista.verMas}>
            Ver más
          </Boton>
        </div>
      )}
    </section>
  );
}