import Plegable from '../../shared/Plegable.jsx';

function Lista({ titulo, bloque }) {
  const { total, filas } = bloque;
  return (
    <Plegable titulo={`${titulo}: ${total === 0 ? 'todos se vendieron' : `${total} sin ventas`}`} abiertaInicial={false}>
      {total === 0 ? (
        <p className="text-sm text-emerald-700">No quedó ninguno sin venderse en este periodo.</p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filas.map((x) => (
              <li key={x.id} className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] px-3 py-2 text-sm">
                <p className="font-medium truncate">{x.nombre}</p>
                <p className="text-xs text-neutral-500 truncate">{x.departamento}</p>
              </li>
            ))}
          </ul>
          {total > filas.length && <p className="mt-2 text-xs text-neutral-400">Se muestran {filas.length} de {total}.</p>}
        </>
      )}
    </Plegable>
  );
}

// giro: 'todo' | 'servicios' | 'productos' (lo mismo que el filtro del reporte)
export default function SinVentas({ sinVentas, esLimpieza, giro }) {
  const productos = giro !== 'servicios';
  const servicios = esLimpieza && giro !== 'productos';
  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 space-y-3">
      <div>
        <h3 className="font-semibold tracking-tight">Lo que no se vendió</h3>
        <p className="text-xs text-neutral-500 mt-0.5">Productos y servicios activos que no tuvieron ninguna venta en el periodo.</p>
      </div>
      {productos && <Lista titulo="Productos" bloque={sinVentas.productos} />}
      {servicios && <Lista titulo="Servicios" bloque={sinVentas.servicios} />}
    </section>
  );
}