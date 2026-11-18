import Campo from '../../shared/Campo.jsx';
import Plegable from '../../shared/Plegable.jsx';
import { formatearMoneda } from '../../../utils/formato.js';

// valor: { [sucursalId]: { precios: { [tipoId]: "140" } } }  (si está, la sucursal está elegida)
// tipos: solo los tipos de artículo que ya tienen precio general
export default function EditorSucursalesServicio({ sucursales, valor, onCambiar, tipos, preciosGenerales, onPrecio, moneda }) {
  const alternar = (id) => {
    const k = String(id);
    const nuevo = { ...valor };
    if (nuevo[k]) delete nuevo[k];
    else nuevo[k] = { precios: {} };
    onCambiar(nuevo);
  };

  if (sucursales.length === 0) return <p className="text-sm text-neutral-400">No tienes sucursales asignadas.</p>;

  return (
    <div className="space-y-3">
      {sucursales.map((s) => {
        const k = String(s.id);
        const elegida = !!valor[k];
        const tieneAjustes = elegida && Object.values(valor[k].precios).some((v) => v !== '');
        return (
          <div key={s.id} className="rounded-2xl border border-neutral-200 p-4">
            <label className="flex items-center gap-3 min-h-11 font-medium">
              <input type="checkbox" className="size-5 accent-[var(--c-primario)]" checked={elegida} onChange={() => alternar(s.id)} />
              {s.nombre}
            </label>

            {elegida && tipos.length > 0 && (
              <div className="mt-2">
                <Plegable titulo="Precio distinto en esta sucursal" abiertaInicial={tieneAjustes}>
                  {tipos.map((t) => (
                    <Campo
                      key={t.id}
                      etiqueta={`${t.nombre} aquí`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={valor[k].precios[t.id] ?? ''}
                      placeholder={`Igual al general (${formatearMoneda(preciosGenerales[t.id], moneda)})`}
                      onChange={(e) => onPrecio(k, String(t.id), e.target.value)}
                      ayuda="Vacío = usa el precio general"
                    />
                  ))}
                </Plegable>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}