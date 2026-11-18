import { useEffect, useRef, useState } from 'react';
import * as svc from '../../../services/promociones.service.js';
import Campo from '../../shared/Campo.jsx';

// tipo: 'producto' | 'servicio' | 'presentacion'. yaElegido(op) es opcional.
export default function BuscadorOpciones({ tipo, etiqueta, yaElegido, onElegir }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const ultima = useRef(0);

  useEffect(() => {
    const espera = setTimeout(
      async () => {
        const n = ++ultima.current;
        setCargando(true);
        try {
          const r = await svc.buscar(tipo, texto.trim() || undefined);
          if (n === ultima.current) {
            setResultados(r);
            setError('');
          }
        } catch (e) {
          if (n === ultima.current) setError(e.message);
        } finally {
          if (n === ultima.current) setCargando(false);
        }
      },
      texto ? 300 : 0
    );
    return () => clearTimeout(espera);
  }, [tipo, texto]);

  return (
    <div className="space-y-2">
      <Campo etiqueta={etiqueta} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={60} placeholder="Escribe el nombre o el código" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className={`max-h-56 overflow-y-auto rounded-2xl border border-[var(--c-borde)] divide-y divide-[var(--c-borde)] bg-white ${cargando ? 'opacity-60' : ''}`}>
        {resultados.length === 0 && !cargando && <li className="px-4 py-3 text-sm text-neutral-500">No encontramos nada.</li>}
        {resultados.map((op) => (
          <li key={op.id}>
            <button type="button" onClick={() => onElegir(op)} className="w-full min-h-11 px-4 py-2 flex items-center justify-between gap-3 text-left hover:bg-[#faf8f3]">
              <span className="min-w-0">
                <span className="block truncate">{op.nombre}</span>
                {op.sku && <span className="block text-xs text-neutral-400">{op.sku}</span>}
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--c-primario-2)]">{yaElegido?.(op) ? '✓ Agregado' : '+ Agregar'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}