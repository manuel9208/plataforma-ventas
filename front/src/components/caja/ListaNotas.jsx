import { sumarDias } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { hoyISO } from '../../utils/formato.js';
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
const PESTANAS_CON_FECHA = ['cobrar', 'espera', 'entregar'];

const chip = (activo) =>
  `min-h-9 px-3.5 rounded-xl text-xs font-semibold transition ${
    activo ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-[var(--c-borde)] text-neutral-600 hover:border-[var(--c-acento)]'
  }`;

export default function ListaNotas({ lista, onAbrir }) {
  const { usuario } = useAuth();
  const gestor = tienePermiso(usuario.permisos, 'notas.gestionar');
  const opciones = [...PARA_TODOS, ...(gestor ? DE_GESTION : [])].map(([id, nombre]) => ({
    id,
    nombre,
    contador: lista.conteos[id],
  }));

  const hoy = hoyISO();
  const manana = sumarDias(hoy, 1);
  const admiteFecha = PESTANAS_CON_FECHA.includes(lista.pestana);
  const esTodas = !lista.fecha && !lista.atrasadas;

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

      <Segmentos className="mb-4" opciones={opciones} valor={lista.pestana} onCambio={lista.cambiarPestana} />

      {admiteFecha && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => lista.ponerFecha('')} className={chip(esTodas)}>
            Todas
          </button>
          <button type="button" onClick={() => lista.ponerFecha(hoy)} className={chip(lista.fecha === hoy && !lista.atrasadas)}>
            Hoy
          </button>
          <button type="button" onClick={() => lista.ponerFecha(manana)} className={chip(lista.fecha === manana && !lista.atrasadas)}>
            Mañana
          </button>
          <input
            type="date"
            aria-label="Filtrar por fecha de entrega"
            value={lista.fecha}
            onChange={(e) => lista.ponerFecha(e.target.value)}
            className="min-h-9 px-3 rounded-xl bg-white border border-[var(--c-borde)] text-xs text-neutral-700 outline-none focus:border-[var(--c-acento)]"
          />
          <button
            type="button"
            onClick={() => lista.ponerAtrasadas(!lista.atrasadas)}
            className={`min-h-9 px-3.5 rounded-xl text-xs font-semibold transition ${
              lista.atrasadas
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50/80 border border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Atrasadas
          </button>
          <button type="button" onClick={() => lista.ponerCotizar(!lista.cotizar)} className={chip(lista.cotizar)}>
            Por cotizar
          </button>
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