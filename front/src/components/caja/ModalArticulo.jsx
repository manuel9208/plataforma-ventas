import { useState } from 'react';
import { CAMPOS_ARTICULO, sumarDias } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import CampoSugerido from './CampoSugerido.jsx';

// Campos con sugerencias de lo ya escrito; el resto se escribe libre
const CON_SUGERENCIAS = ['marca', 'talla', 'color', 'modelo', 'textura'];

// inicial: un artículo ya capturado cuando se edita o se duplica
export default function ModalArticulo({ servicio, precio, config, inicial, onAceptar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const dias = servicio.tiempoDias ?? 0;
  const fechaPorDefecto = sumarDias(config.hoy, dias);

  const [articulo, setArticulo] = useState(() =>
    Object.fromEntries(CAMPOS_ARTICULO.map(({ clave }) => [clave, inicial?.articulo?.[clave] ?? '']))
  );
  const [extraIds, setExtraIds] = useState(inicial?.extraIds ?? []);
  const [fecha, setFecha] = useState(inicial?.fechaPrometida ?? fechaPorDefecto);

  const visibles = CAMPOS_ARTICULO.filter(({ clave }) => config.camposArticulo[clave] !== 'oculto');
  const alternarExtra = (id) => setExtraIds((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const enviar = (e) => {
    e.preventDefault();
    onAceptar({
      articulo,
      extraIds,
      // Solo se manda la fecha si el cajero la cambió; si no, el servidor calcula la suya
      fechaPrometida: fecha !== fechaPorDefecto ? fecha : null,
      fechaMostrada: fecha,
    });
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={servicio.nombre}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-articulo" className="flex-1">
            {inicial ? 'Guardar' : 'Agregar a la nota'}
          </Boton>
        </>
      }
    >
      <form id="form-articulo" onSubmit={enviar} className="space-y-5">
        <p className="text-sm text-neutral-500">
          {precio.tipo} · <span className="font-semibold text-neutral-800">{dinero(precio.precio)}</span>
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {visibles.map(({ clave, etiqueta }) => {
            const obligatorio = config.camposArticulo[clave] === 'obligatorio';
            if (CON_SUGERENCIAS.includes(clave)) {
              return (
                <CampoSugerido
                  key={clave}
                  campo={clave}
                  etiqueta={etiqueta}
                  valor={articulo[clave]}
                  obligatorio={obligatorio}
                  onCambio={(v) => setArticulo((a) => ({ ...a, [clave]: v }))}
                />
              );
            }
            return (
              <Campo
                key={clave}
                className="sm:col-span-2"
                etiqueta={obligatorio ? `${etiqueta} *` : etiqueta}
                value={articulo[clave]}
                onChange={(e) => setArticulo((a) => ({ ...a, [clave]: e.target.value }))}
                maxLength={300}
                required={obligatorio}
              />
            );
          })}
        </div>

        {servicio.extras.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-neutral-600 mb-2">Extras</legend>
            <div className="space-y-1">
              {servicio.extras.map((x) => (
                <label key={x.id} className="flex items-center gap-3 min-h-11">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--c-primario)]"
                    checked={extraIds.includes(x.id)}
                    onChange={() => alternarExtra(x.id)}
                  />
                  <span className="flex-1">{x.nombre}</span>
                  <span className="text-sm text-neutral-400">{dinero(x.precio)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Campo
          etiqueta="Fecha prometida"
          type="date"
          min={config.hoy}
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          ayuda={
            fecha === fechaPorDefecto
              ? `Según el servicio: ${formatearFechaLarga(fechaPorDefecto)}. Puedes cambiarla.`
              : `Cambiaste la fecha. La del servicio era el ${formatearFechaLarga(fechaPorDefecto)}.`
          }
          required
        />
      </form>
    </Modal>
  );
}