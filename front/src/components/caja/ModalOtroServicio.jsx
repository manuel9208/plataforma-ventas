import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';

// catalogo: el hook useCatalogoServicios de Caja · onElegir(servicio, precio)
export default function ModalOtroServicio({ catalogo, tipoArticuloId, tipoNombre, onElegir, onCerrar }) {
  const { empresa } = useAuth();
  const opciones = catalogo.datos
    .map((s) => ({ s, p: s.precios.find((x) => x.tipoArticuloId === tipoArticuloId) }))
    .filter((x) => x.p);

  return (
    <Modal abierto titulo={`Otro servicio · ${tipoNombre}`} onCerrar={onCerrar}>
      <div className="space-y-3">
        <Campo etiqueta="Buscar servicio" value={catalogo.buscar} onChange={(e) => catalogo.setBuscar(e.target.value)} autoFocus />

        {catalogo.cargando && opciones.length === 0 ? (
          <p className="text-center text-neutral-400 py-6">Cargando…</p>
        ) : opciones.length === 0 ? (
          <p className="text-center text-neutral-400 py-6">No hay servicios para este tipo de artículo.</p>
        ) : (
          <ul className="space-y-2">
            {opciones.map(({ s, p }) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onElegir(s, p)}
                  className="w-full min-h-14 px-4 rounded-2xl border border-[var(--c-borde)] bg-white flex items-center justify-between gap-3 text-left hover:border-[var(--c-acento)]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{s.nombre}</span>
                    <span className="block text-xs text-neutral-500 truncate">{s.departamento}</span>
                  </span>
                  <span className="font-semibold shrink-0">{formatearMoneda(p.precio, empresa.moneda)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {catalogo.hayMas && (
          <div className="flex justify-center">
            <Boton variante="secundario" cargando={catalogo.cargando} onClick={catalogo.verMas}>
              Ver más
            </Boton>
          </div>
        )}
      </div>
    </Modal>
  );
}