import Campo from '../../shared/Campo.jsx';
import CodigosBarras from './CodigosBarras.jsx';
import ReglasMayoreo from './ReglasMayoreo.jsx';

// Precio, códigos de barras y mayoreo de una presentación
export default function CamposPresentacion({ p, onCambiar, unidad, etiquetaPrecio }) {
  return (
    <div className="space-y-4">
      <Campo
        etiqueta={etiquetaPrecio}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={p.precio}
        onChange={(e) => onCambiar({ precio: e.target.value })}
        required
      />
      <CodigosBarras
        codigos={p.codigos}
        codigoInterno={p.codigoInterno}
        generarInterno={p.generarInterno}
        onCambiar={onCambiar}
      />
      <ReglasMayoreo valor={p.mayoreo} onCambiar={(mayoreo) => onCambiar({ mayoreo })} unidad={unidad} />
    </div>
  );
}