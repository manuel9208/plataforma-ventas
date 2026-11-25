import { useState } from 'react';
import { CAMPOS_ARTICULO, MAX_COMENTARIO, sumarDias } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import Plegable from '../shared/Plegable.jsx';
import CamposArticulo from './CamposArticulo.jsx';

// modo: 'completo' (artículo nuevo + servicio) · 'datos' (solo el artículo) · 'servicio' (solo extras y fecha)
// inicialDatos: { datos, comentario } · inicialServicio: { extraIds, fechaPrometida, fechaMostrada }
export default function ModalArticulo({ modo = 'completo', servicio, precio, config, inicialDatos, inicialServicio, onAceptar, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const conDatos = modo !== 'servicio';
  const conServicio = modo !== 'datos';
  const cotiza = conServicio && servicio?.requiereCotizacion === true;

  const dias = servicio?.tiempoDias ?? 0;
  const fechaPorDefecto = sumarDias(config.hoy, dias);

  const [datos, setDatos] = useState(() =>
    Object.fromEntries(CAMPOS_ARTICULO.map(({ clave }) => [clave, inicialDatos?.datos?.[clave] ?? '']))
  );
  const [comentario, setComentario] = useState(inicialDatos?.comentario ?? '');
  const [extraIds, setExtraIds] = useState(inicialServicio?.extraIds ?? []);
  const [fecha, setFecha] = useState(inicialServicio?.fechaMostrada ?? fechaPorDefecto);

  const alternarExtra = (id) => setExtraIds((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const enviar = (e) => {
    e.preventDefault();
    onAceptar({
      datos,
      comentario,
      extraIds: cotiza ? [] : extraIds,
      // Solo se manda la fecha si el cajero la cambió; si no, el servidor calcula la suya
      fechaPrometida: conServicio && !cotiza && fecha !== fechaPorDefecto ? fecha : null,
      fechaMostrada: cotiza ? null : fecha,
    });
  };

  const titulo = conServicio ? servicio.nombre : 'Datos del artículo';
  const boton = modo === 'completo' ? 'Agregar a la nota' : modo === 'servicio' && !inicialServicio ? 'Agregar servicio' : 'Guardar';

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-articulo" className="flex-1">
            {boton}
          </Boton>
        </>
      }
    >
      <form id="form-articulo" onSubmit={enviar} className="space-y-5">
        {conServicio && (
          <p className="text-sm text-neutral-500">
            {precio.tipo}
            {!cotiza && (
              <>
                {' · '}
                <span className="font-semibold text-neutral-800">{dinero(precio.precio)}</span>
              </>
            )}
          </p>
        )}
        {cotiza && (
          <div className="rounded-xl bg-amber-50 text-amber-800 text-sm p-3">
            Este servicio se cotiza. El precio y la fecha de entrega se definen al cotizar la nota.
          </div>
        )}

        {conDatos && (
          <>
            <CamposArticulo config={config} datos={datos} onCambio={(clave, v) => setDatos((a) => ({ ...a, [clave]: v }))} />

            <Plegable titulo="Comentario interno (opcional)" abiertaInicial={Boolean(comentario)}>
              <Campo
                etiqueta="Comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                maxLength={MAX_COMENTARIO}
                ayuda="Solo lo ve tu equipo. No sale en el ticket del cliente."
              />
            </Plegable>
          </>
        )}

        {conServicio && !cotiza && servicio.extras.length > 0 && (
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

        {conServicio && !cotiza && (
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
        )}
      </form>
    </Modal>
  );
}