import { useMemo, useState } from 'react';

const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Lista de permisos con buscador, agrupada por módulo.
// catalogo: [{ clave, etiqueta, grupo }]   valor: { clave: true }
export default function SelectorPermisos({ catalogo, valor, puedeOtorgar, onCambiar }) {
  const [busqueda, setBusqueda] = useState('');

  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const mapa = new Map();
    for (const p of catalogo) {
      if (q && !normalizar(`${p.etiqueta} ${p.grupo}`).includes(q)) continue;
      if (!mapa.has(p.grupo)) mapa.set(p.grupo, []);
      mapa.get(p.grupo).push(p);
    }
    return [...mapa.entries()];
  }, [catalogo, busqueda]);

  const activos = catalogo.filter((p) => valor[p.clave] === true).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar permiso"
          className="flex-1 min-h-11 px-4 rounded-2xl bg-white border border-neutral-300 text-base outline-none focus:border-[var(--c-primario)]"
        />
        <span className="text-xs text-neutral-500 whitespace-nowrap">
          {activos} de {catalogo.length}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
        {grupos.length === 0 && <p className="text-sm text-neutral-400">Sin resultados.</p>}
        {grupos.map(([grupo, items]) => (
          <div key={grupo}>
            <p className="text-xs font-semibold text-neutral-400 mb-1">{grupo}</p>
            {items.map((p) => {
              const activo = valor[p.clave] === true;
              // La casilla de una pantalla queda fija mientras otro permiso activo la necesite
              const lanecesitan = catalogo.filter((x) => x.requiere === p.clave && valor[x.clave] === true);
              return (
                <label key={p.clave} className="flex items-center gap-3 min-h-11">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--c-primario)]"
                    checked={activo}
                    disabled={(!puedeOtorgar(p.clave) && !activo) || (activo && lanecesitan.length > 0)}
                    onChange={() => {
                      const nuevo = { ...valor, [p.clave]: !activo };
                      // Un permiso de administración necesita la pantalla de Administración: se marca sola
                      if (!activo && p.requiere) nuevo[p.requiere] = true;
                      onCambiar(nuevo);
                    }}
                  />
                  <span>
                    {p.etiqueta}
                    {activo && lanecesitan.length > 0 && (
                      <span className="block text-xs text-neutral-400">Lo necesita {lanecesitan[0].etiqueta.toLowerCase()}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}