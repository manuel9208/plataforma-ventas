import Interruptor from '../../shared/Interruptor.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import { plural } from '../../../utils/formato.js';

let contador = 0;
const nuevaRegla = () => ({ _k: `r${++contador}`, cantidadMinima: '', precio: '' });

// valor: [{ _k, cantidadMinima, precio }]   unidad: "pieza", "cartón"…
export default function ReglasMayoreo({ valor, onCambiar, unidad }) {
  const cambiar = (k, cambios) => onCambiar(valor.map((r) => (r._k === k ? { ...r, ...cambios } : r)));

  return (
    <div className="space-y-3">
      <Interruptor
        etiqueta="¿Se vende a mayoreo?"
        descripcion="Si llevan varios, cada uno sale más barato."
        valor={valor.length > 0}
        onCambiar={(v) => onCambiar(v ? [nuevaRegla()] : [])}
      />
      {valor.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Ejemplo: desde 5, cada uno cuesta $125.</p>
          {valor.map((r) => (
            <div key={r._k} className="flex items-end gap-2">
              <Campo
                className="flex-1"
                etiqueta={`Desde (${plural(unidad)})`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={r.cantidadMinima}
                onChange={(e) => cambiar(r._k, { cantidadMinima: e.target.value })}
                required
              />
              <Campo
                className="flex-1"
                etiqueta={`Precio de cada ${unidad}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={r.precio}
                onChange={(e) => cambiar(r._k, { precio: e.target.value })}
                required
              />
              <button
                type="button"
                aria-label="Quitar este precio"
                onClick={() => onCambiar(valor.filter((x) => x._k !== r._k))}
                className="size-12 shrink-0 rounded-2xl bg-neutral-200/70 text-neutral-600"
              >
                ✕
              </button>
            </div>
          ))}
          <Boton compacto variante="secundario" onClick={() => onCambiar([...valor, nuevaRegla()])}>
            + Agregar otro precio
          </Boton>
        </div>
      )}
    </div>
  );
}