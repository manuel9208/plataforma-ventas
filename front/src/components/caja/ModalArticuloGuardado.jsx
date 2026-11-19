import { useState } from 'react';
import { CAMPOS_ARTICULO, MAX_COMENTARIO, sumarDias } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import CamposArticulo from './CamposArticulo.jsx';
import ModalOtroServicio from './ModalOtroServicio.jsx';

let contador = 0;

const desdeGuardado = (s) => ({
  id: `g${s.servicioId}-${s.tipoArticuloId}`,
  servicio: s.servicio,
  precio: s.precio,
  extraIds: s.extraIds ?? [],
  marcado: true,
});

// Revisión de un artículo guardado del cliente: datos, comentario y servicios (los de la última vez, ya marcados)
// articulo: lo que manda el servidor · catalogo: useCatalogoServicios · maxServicios: lugar que queda en la nota
// onAceptar({ datos, comentario, servicios: [{ servicio, precio, extraIds, fechaPrometida, fechaMostrada }] })
export default function ModalArticuloGuardado({ articulo, config, catalogo, maxServicios, onAceptar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  // "Cómo llega" es el estado de ESTA visita: arranca vacío
  const [datos, setDatos] = useState(() =>
    Object.fromEntries(CAMPOS_ARTICULO.map(({ clave }) => [clave, clave === 'descripcion' ? '' : (articulo.datos[clave] ?? '')]))
  );
  const [comentario, setComentario] = useState('');
  const [items, setItems] = useState(() => articulo.servicios.filter((s) => s.disponible === true).map(desdeGuardado));
  const [eligiendo, setEligiendo] = useState(false);

  const noDisponibles = articulo.servicios.filter((s) => s.disponible !== true);
  // Para "+ Otro servicio" se usa el tipo de artículo con el que vino
  const referencia = articulo.servicios[0];
  const marcados = items.filter((i) => i.marcado);
  const puede = marcados.length > 0 && marcados.length <= maxServicios;

  const alternar = (id) => setItems((l) => l.map((i) => (i.id === id ? { ...i, marcado: !i.marcado } : i)));
  const alternarExtra = (id, extraId) =>
    setItems((l) =>
      l.map((i) =>
        i.id === id
          ? { ...i, extraIds: i.extraIds.includes(extraId) ? i.extraIds.filter((x) => x !== extraId) : [...i.extraIds, extraId] }
          : i
      )
    );

  const cerrarOtro = () => {
    setEligiendo(false);
    catalogo.setBuscar('');
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!puede) return;
    onAceptar({
      datos,
      comentario,
      servicios: marcados.map((i) => ({
        servicio: i.servicio,
        precio: i.precio,
        extraIds: i.extraIds,
        // La fecha la calcula el servidor según el servicio; se puede cambiar después con "Editar"
        fechaPrometida: null,
        fechaMostrada: sumarDias(config.hoy, i.servicio.tiempoDias ?? 0),
      })),
    });
  };

  return (
    <>
      <Modal
        abierto
        ancho="sm:max-w-xl"
        titulo="Revisar artículo"
        onCerrar={onCerrar}
        pie={
          <>
            <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" form="form-articulo-guardado" className="flex-1" disabled={!puede}>
              Agregar a la nota
            </Boton>
          </>
        }
      >
        <form id="form-articulo-guardado" onSubmit={enviar} className="space-y-5">
          <CamposArticulo config={config} datos={datos} onCambio={(clave, v) => setDatos((a) => ({ ...a, [clave]: v }))} />

          <Campo
            etiqueta="Comentario interno"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={MAX_COMENTARIO}
            ayuda="Revisa si trae daños y anótalos aquí. Solo lo ve tu equipo; no sale en el ticket."
          />

          <fieldset>
            <legend className="text-sm font-medium text-neutral-600 mb-2">Servicios</legend>
            <ul className="space-y-2">
              {items.map((i) => (
                <li
                  key={i.id}
                  className={`rounded-2xl border p-3 ${i.marcado ? 'border-[var(--c-acento)] bg-white' : 'border-[var(--c-borde)] bg-[#faf8f3]'}`}
                >
                  <label className="flex items-center gap-3 min-h-11">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--c-primario)]"
                      checked={i.marcado}
                      onChange={() => alternar(i.id)}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{i.servicio.nombre}</span>
                      <span className="block text-xs text-neutral-500">{i.precio.tipo}</span>
                    </span>
                    <span className="font-semibold shrink-0">{dinero(i.precio.precio)}</span>
                  </label>

                  {i.marcado && i.servicio.extras.length > 0 && (
                    <div className="mt-1 pl-8 space-y-1">
                      {i.servicio.extras.map((x) => (
                        <label key={x.id} className="flex items-center gap-3 min-h-9 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--c-primario)]"
                            checked={i.extraIds.includes(x.id)}
                            onChange={() => alternarExtra(i.id, x.id)}
                          />
                          <span className="flex-1">+ {x.nombre}</span>
                          <span className="text-neutral-400">{dinero(x.precio)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              ))}

              {noDisponibles.map((s) => (
                <li
                  key={`x${s.servicioId}-${s.tipoArticuloId}`}
                  className="rounded-2xl border border-dashed border-[var(--c-borde)] px-3 py-2 text-sm text-neutral-400"
                >
                  <span className="line-through">{s.nombre}</span> · ya no está disponible en esta sucursal
                </li>
              ))}
            </ul>

            {referencia && (
              <button type="button" onClick={() => setEligiendo(true)} className="mt-3 text-sm font-medium text-[var(--c-primario)]">
                + Otro servicio
              </button>
            )}
            {marcados.length === 0 && <p className="mt-2 text-xs text-amber-700">Elige al menos un servicio.</p>}
            {marcados.length > maxServicios && (
              <p className="mt-2 text-xs text-amber-700">Solo caben {Math.max(maxServicios, 0)} servicios más en esta nota.</p>
            )}
          </fieldset>
        </form>
      </Modal>

      {eligiendo && referencia && (
        <ModalOtroServicio
          catalogo={catalogo}
          tipoArticuloId={referencia.tipoArticuloId}
          tipoNombre={referencia.tipo}
          onElegir={(servicio, precio) => {
            setItems((l) => [...l, { id: `n${++contador}`, servicio, precio, extraIds: [], marcado: true }]);
            cerrarOtro();
          }}
          onCerrar={cerrarOtro}
        />
      )}
    </>
  );
}