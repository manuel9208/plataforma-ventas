import { useAuth } from '../../context/AuthContext.jsx';
import { tienePermiso } from '../../utils/permisos.js';
import Boton from '../shared/Boton.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import Segmentos from '../shared/Segmentos.jsx';
import TarjetaNota from './TarjetaNota.jsx';

const PARA_TODOS = [
  ['cobrar', 'Por cobrar'],
  ['espera', 'En espera'],
  ['entregar', 'Por entregar'],
];
// Solo se muestran con el permiso notas.gestionar (el servidor también lo exige)
const DE_GESTION = [
  ['entregadas', 'Entregadas'],
  ['canceladas', 'Canceladas'],
];
const VACIO = {
  cobrar: 'No hay notas con saldo por cobrar.',
  espera: 'No hay trabajos en espera.',
  entregar: 'No hay trabajos listos para entregar.',
  entregadas: 'Aún no hay notas entregadas.',
  canceladas: 'No hay notas canceladas.',
};

export default function ListaNotas({ lista, onAbrir }) {
  const { usuario } = useAuth();
  const gestor = tienePermiso(usuario.permisos, 'notas.gestionar');
  const opciones = [...PARA_TODOS, ...(gestor ? DE_GESTION : [])].map(([id, nombre]) => ({
    id,
    nombre,
    contador: lista.conteos[id],
  }));

  return (
    <section>
      <div className="relative mb-4">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icono nombre="buscar" className="size-5" />
        </span>
        <input
          value={lista.buscar}
          onChange={(e) => lista.setBuscar(e.target.value)}
          placeholder="Busca por folio, teléfono o nombre"
          className="w-full min-h-14 pl-12 pr-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
        />
      </div>

      <Segmentos className="mb-5" opciones={opciones} valor={lista.pestana} onCambio={lista.cambiarPestana} />

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
            {lista.consulta ? `No encontramos notas con "${lista.consulta}" en esta pestaña.` : VACIO[lista.pestana]}
          </p>
        )
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition ${lista.refrescando ? 'opacity-60' : ''}`}>
          {lista.datos.map((n) => (
            <TarjetaNota key={n.id} nota={n} pestana={lista.pestana} onAbrir={onAbrir} />
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