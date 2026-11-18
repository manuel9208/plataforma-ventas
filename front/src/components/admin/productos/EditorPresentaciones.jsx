import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import CamposPresentacion from './CamposPresentacion.jsx';
import { presentacionNueva, nombrePresentacion } from './productoForm.js';
import { plural } from '../../../utils/formato.js';

// Otras presentaciones (caja, cartón, paquete…). La principal se captura arriba en el formulario.
export default function EditorPresentaciones({ valor, onCambiar, unidades, unidadBase }) {
  const nombreUnidad = (c) => unidades.find((u) => u.clave === c)?.nombre ?? c;
  const extras = valor.filter((p) => !p.esBase);

  const actualizar = (k, cambios) => onCambiar(valor.map((p) => (p._k === k ? { ...p, ...cambios } : p)));

  // Si cambia la unidad o la cantidad, el nombre se arma solo (ej. "Cartón de 12")
  const cambiarForma = (p, cambios) => {
    const unidad = cambios.unidad ?? p.unidad;
    const factor = cambios.factor ?? p.factor;
    actualizar(p._k, { ...cambios, nombre: nombrePresentacion(unidades, unidad, factor) });
  };

  return (
    <div className="space-y-3">
      {extras.map((p) => (
        <div key={p._k} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold truncate">{p.nombre || 'Nueva presentación'}</p>
            <Boton compacto variante="secundario" onClick={() => onCambiar(valor.filter((x) => x._k !== p._k))}>
              Quitar
            </Boton>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Selector etiqueta="Presentación" value={p.unidad} onChange={(e) => cambiarForma(p, { unidad: e.target.value })}>
              {unidades.map((u) => (
                <option key={u.clave} value={u.clave}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
            <Campo
              etiqueta={`¿Cuántas ${plural(nombreUnidad(unidadBase))} trae? *`}
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={p.factor}
              onChange={(e) => cambiarForma(p, { factor: e.target.value })}
              placeholder="Ejemplo: 12"
              required
            />
          </div>

          <CamposPresentacion
            p={p}
            onCambiar={(cambios) => actualizar(p._k, cambios)}
            unidad={nombreUnidad(p.unidad).toLowerCase()}
            etiquetaPrecio={`Precio de ${p.nombre || 'esta presentación'} *`}
          />
        </div>
      ))}

      <Boton
        variante="secundario"
        className="w-full"
        onClick={() => onCambiar([...valor, presentacionNueva({ nombre: nombreUnidad('carton'), unidad: 'carton' })])}
      >
        + Agregar caja, cartón o paquete
      </Boton>
    </div>
  );
}