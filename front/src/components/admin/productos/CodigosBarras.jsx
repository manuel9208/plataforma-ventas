import { useState } from 'react';
import Boton from '../../shared/Boton.jsx';

export default function CodigosBarras({ codigos, codigoInterno, generarInterno, onCambiar }) {
  const [texto, setTexto] = useState('');

  const agregar = () => {
    const c = texto.trim();
    setTexto('');
    if (c.length < 3 || codigos.includes(c) || codigoInterno === c) return;
    onCambiar({ codigos: [...codigos, c] });
  };

  return (
    <div>
      <span className="block text-sm font-medium text-neutral-600 mb-1.5">Código de barras (opcional)</span>
      {(codigoInterno || codigos.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {codigoInterno && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">Propio: {codigoInterno}</span>
          )}
          {codigos.map((c) => (
            <span key={c} className="text-xs px-3 py-1.5 rounded-full bg-neutral-200 flex items-center gap-2">
              {c}
              <button
                type="button"
                aria-label={`Quitar ${c}`}
                onClick={() => onCambiar({ codigos: codigos.filter((x) => x !== c) })}
                className="text-neutral-500"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // El lector de códigos termina con Enter: se agrega el código sin enviar el formulario
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Escanea o escribe el código"
          className="flex-1 min-h-11 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton compacto variante="secundario" onClick={agregar}>
          Agregar
        </Boton>
      </div>
      {!codigoInterno &&
        (generarInterno ? (
          <p className="text-xs text-neutral-500 mt-2">Se creará un código propio al guardar.</p>
        ) : (
          <button
            type="button"
            onClick={() => onCambiar({ generarInterno: true })}
            className="text-sm font-medium text-[var(--c-primario)] mt-2"
          >
            Crear un código propio
          </button>
        ))}
    </div>
  );
}