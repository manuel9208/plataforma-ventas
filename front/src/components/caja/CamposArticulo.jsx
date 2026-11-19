import { CAMPOS_ARTICULO } from '@plataforma/calculos';
import Campo from '../shared/Campo.jsx';
import CampoSugerido from './CampoSugerido.jsx';

// Campos con sugerencias de lo ya escrito; el resto se escribe libre
const CON_SUGERENCIAS = ['marca', 'talla', 'color', 'modelo', 'textura'];

// config.camposArticulo: oculto / opcional / obligatorio por campo · onCambio(clave, valor)
export default function CamposArticulo({ config, datos, onCambio }) {
  const visibles = CAMPOS_ARTICULO.filter(({ clave }) => config.camposArticulo[clave] !== 'oculto');

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {visibles.map(({ clave, etiqueta }) => {
        const obligatorio = config.camposArticulo[clave] === 'obligatorio';
        if (CON_SUGERENCIAS.includes(clave)) {
          return (
            <CampoSugerido
              key={clave}
              campo={clave}
              etiqueta={etiqueta}
              valor={datos[clave]}
              obligatorio={obligatorio}
              onCambio={(v) => onCambio(clave, v)}
            />
          );
        }
        return (
          <Campo
            key={clave}
            className="sm:col-span-2"
            etiqueta={obligatorio ? `${etiqueta} *` : etiqueta}
            value={datos[clave]}
            onChange={(e) => onCambio(clave, e.target.value)}
            maxLength={300}
            required={obligatorio}
          />
        );
      })}
    </div>
  );
}