import Campo from '../../shared/Campo.jsx';
import Plegable from '../../shared/Plegable.jsx';
import { formatearMoneda, plural } from '../../../utils/formato.js';

// valor: { [sucursalId]: { stockMinimo } }  (si está, la sucursal está elegida)
export default function EditorSucursales({ sucursales, valor, onCambiar, presentaciones, onPrecio, unidadNombre, moneda }) {
  const nombradas = presentaciones.filter((p) => p.nombre.trim());

  const alternar = (id) => {
    const k = String(id);
    const nuevo = { ...valor };
    if (nuevo[k]) delete nuevo[k];
    else nuevo[k] = { stockMinimo: '0' };
    onCambiar(nuevo);
  };

  if (sucursales.length === 0) return <p className="text-sm text-neutral-400">No tienes sucursales asignadas.</p>;

  return (
    <div className="space-y-3">
      {sucursales.map((s) => {
        const k = String(s.id);
        const elegida = !!valor[k];
        const tieneAjustes =
          elegida &&
          (Number(valor[k].stockMinimo) > 0 ||
            nombradas.some((p) => p.preciosSucursal[k] !== undefined && p.preciosSucursal[k] !== ''));
        return (
          <div key={s.id} className="rounded-2xl border border-neutral-200 p-4">
            <label className="flex items-center gap-3 min-h-11 font-medium">
              <input type="checkbox" className="size-5 accent-[var(--c-primario)]" checked={elegida} onChange={() => alternar(s.id)} />
              {s.nombre}
            </label>

            {elegida && (
              <div className="mt-2">
                <Plegable titulo="Precio y mínimo en esta sucursal" abiertaInicial={tieneAjustes}>
                  {nombradas.map((p) => (
                    <Campo
                      key={p._k}
                      etiqueta={`Precio de ${p.nombre.trim()} aquí`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={p.preciosSucursal[k] ?? ''}
                      placeholder={p.precio === '' ? 'Igual al general' : `Igual al general (${formatearMoneda(p.precio, moneda)})`}
                      onChange={(e) => onPrecio(p._k, k, e.target.value)}
                      ayuda="Vacío = usa el precio general"
                    />
                  ))}
                  <Campo
                    etiqueta={`Avisar cuando queden menos de (${plural(unidadNombre)})`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={valor[k].stockMinimo}
                    onChange={(e) => onCambiar({ ...valor, [k]: { ...valor[k], stockMinimo: e.target.value } })}
                  />
                </Plegable>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}