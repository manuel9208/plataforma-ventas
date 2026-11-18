import { useState } from 'react';
import Segmentos from '../../shared/Segmentos.jsx';
import Selector from '../../shared/Selector.jsx';
import BuscadorOpciones from './BuscadorOpciones.jsx';

const MAX_ARTICULOS = 10;
const MAX_CANTIDAD = 20;
const clave = (i) => (i.presentacionId != null ? `p${i.presentacionId}` : `s${i.servicioId}|${i.tipoArticuloId ?? '*'}`);

// valor = [{ presentacionId?, servicioId?, tipoArticuloId?, cantidad, nombre, tipoArticulo }]
export default function SelectorArticulosCombo({ opciones, valor, onCambio }) {
  const limpieza = opciones.giro === 'limpieza';
  const [pestana, setPestana] = useState('producto');
  const [tipoId, setTipoId] = useState('');

  const cambiarCantidad = (k, cantidad) => onCambio(valor.map((i) => (clave(i) === k ? { ...i, cantidad } : i)));
  const quitar = (k) => onCambio(valor.filter((i) => clave(i) !== k));

  // Si ya está en el combo, se suma una pieza en lugar de repetirlo
  const agregar = (nuevo) => {
    const k = clave(nuevo);
    const existe = valor.find((i) => clave(i) === k);
    if (existe) return cambiarCantidad(k, Math.min(existe.cantidad + 1, MAX_CANTIDAD));
    if (valor.length < MAX_ARTICULOS) onCambio([...valor, nuevo]);
  };

  const elegirProducto = (op) =>
    agregar({ presentacionId: op.id, servicioId: null, tipoArticuloId: null, cantidad: 1, nombre: op.nombre, tipoArticulo: null });

  const elegirServicio = (op) =>
    agregar({
      presentacionId: null,
      servicioId: op.id,
      tipoArticuloId: tipoId ? Number(tipoId) : null,
      cantidad: 1,
      nombre: op.nombre,
      tipoArticulo: opciones.tiposArticulo.find((t) => String(t.id) === tipoId)?.nombre ?? null,
    });

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--c-borde)] p-4">
      <p className="font-medium">¿Qué lleva el combo?</p>
      {limpieza && (
        <Segmentos
          compacto
          opciones={[
            { id: 'producto', nombre: 'Productos' },
            { id: 'servicio', nombre: 'Servicios' },
          ]}
          valor={pestana}
          onCambio={setPestana}
        />
      )}

      {pestana === 'producto' ? (
        <BuscadorOpciones key="p" tipo="presentacion" etiqueta="Buscar un producto" onElegir={elegirProducto} />
      ) : (
        <div className="space-y-3">
          <Selector etiqueta="Tipo de artículo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            <option value="">Cualquier tipo</option>
            {opciones.tiposArticulo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Selector>
          <BuscadorOpciones key="s" tipo="servicio" etiqueta="Buscar un servicio" onElegir={elegirServicio} />
        </div>
      )}

      {valor.length > 0 && (
        <ul className="space-y-2">
          {valor.map((i) => {
            const k = clave(i);
            return (
              <li key={k} className="flex items-center gap-2 rounded-xl bg-[#faf8f3] border border-[var(--c-borde)] px-3 py-2">
                <span className="flex-1 min-w-0 text-sm">
                  <span className="block truncate font-medium">{i.nombre}</span>
                  {i.servicioId != null && <span className="block text-xs text-neutral-500">{i.tipoArticulo ?? 'Cualquier tipo'}</span>}
                </span>
                <button type="button" aria-label="Una menos" disabled={i.cantidad <= 1} onClick={() => cambiarCantidad(k, i.cantidad - 1)} className="size-10 rounded-xl bg-white border border-[var(--c-borde)] disabled:opacity-40">
                  −
                </button>
                <span className="w-6 text-center font-semibold">{i.cantidad}</span>
                <button type="button" aria-label="Una más" disabled={i.cantidad >= MAX_CANTIDAD} onClick={() => cambiarCantidad(k, i.cantidad + 1)} className="size-10 rounded-xl bg-white border border-[var(--c-borde)] disabled:opacity-40">
                  +
                </button>
                <button type="button" aria-label="Quitar" onClick={() => quitar(k)} className="size-10 rounded-xl text-neutral-500 hover:bg-white">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-neutral-500">Cuenta cada pieza: el combo necesita al menos dos. Lo que se vende por peso o medida no entra.</p>
    </div>
  );
}