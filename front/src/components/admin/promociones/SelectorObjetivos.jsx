import { useState } from 'react';
import Segmentos from '../../shared/Segmentos.jsx';
import BuscadorOpciones from './BuscadorOpciones.jsx';

const ETIQUETA = { departamento: 'Departamento', producto: 'Producto', servicio: 'Servicio' };
const MAXIMO = 100;

// valor = [{ tipo, id, nombre }]
export default function SelectorObjetivos({ opciones, valor, onCambio }) {
  const limpieza = opciones.giro === 'limpieza';
  const pestanas = [
    { id: 'departamento', nombre: 'Departamentos' },
    { id: 'producto', nombre: 'Productos' },
    ...(limpieza ? [{ id: 'servicio', nombre: 'Servicios' }] : []),
  ];
  const [pestana, setPestana] = useState('departamento');

  const esta = (tipo, id) => valor.some((o) => o.tipo === tipo && o.id === id);
  const quitar = (tipo, id) => onCambio(valor.filter((o) => !(o.tipo === tipo && o.id === id)));
  const alternar = (tipo, op) => (esta(tipo, op.id) ? quitar(tipo, op.id) : valor.length < MAXIMO && onCambio([...valor, { tipo, id: op.id, nombre: op.nombre }]));

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--c-borde)] p-4">
      <Segmentos compacto opciones={pestanas} valor={pestana} onCambio={setPestana} />

      {pestana === 'departamento' ? (
        <div className="flex flex-wrap gap-2">
          {opciones.departamentos.length === 0 && <p className="text-sm text-neutral-500">Todavía no tienes departamentos.</p>}
          {opciones.departamentos.map((d) => {
            const on = esta('departamento', d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => alternar('departamento', d)}
                className={`min-h-10 px-4 rounded-xl text-sm font-medium transition ${
                  on ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]' : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                }`}
              >
                {d.nombre}
              </button>
            );
          })}
        </div>
      ) : (
        <BuscadorOpciones
          key={pestana}
          tipo={pestana}
          etiqueta={pestana === 'producto' ? 'Buscar un producto' : 'Buscar un servicio'}
          yaElegido={(op) => esta(pestana, op.id)}
          onElegir={(op) => alternar(pestana, op)}
        />
      )}

      {valor.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-2">Elegidos ({valor.length})</p>
          <div className="flex flex-wrap gap-2">
            {valor.map((o) => (
              <span key={`${o.tipo}:${o.id}`} className="inline-flex items-center gap-2 pl-3 pr-1 min-h-9 rounded-xl bg-[#f3efe6] text-sm">
                <span className="text-neutral-500">{ETIQUETA[o.tipo]} ·</span> {o.nombre}
                <button type="button" aria-label="Quitar" onClick={() => quitar(o.tipo, o.id)} className="size-8 rounded-lg text-neutral-500 hover:bg-white">
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}