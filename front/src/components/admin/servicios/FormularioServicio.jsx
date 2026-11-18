import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import Plegable from '../../shared/Plegable.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import EditorSucursalesServicio from './EditorSucursalesServicio.jsx';
import { estadoInicial, armarDatos } from './servicioForm.js';

const ETIQUETAS = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  departamentoId: 'Departamento',
  tasaIvaId: 'IVA',
  tiempoDias: 'Días de entrega',
  precios: 'Precios',
  sucursalIds: 'Sucursales',
  extraIds: 'Extras',
};

const Seccion = ({ titulo, children }) => (
  <div className="space-y-4">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 pt-2">{titulo}</h3>
    {children}
  </div>
);

export default function FormularioServicio({ servicio, opciones, onGuardar, onCerrar }) {
  const { empresa } = useAuth();
  const editando = !!servicio;
  const [f, setF] = useState(() => estadoInicial(servicio, opciones));
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const tipos = opciones.tiposArticulo;
  const tiposConPrecio = tipos.filter((t) => f.precios[t.id] !== undefined && f.precios[t.id] !== '');

  const ponerPrecio = (tipoId, valor) => setF((p) => ({ ...p, precios: { ...p.precios, [tipoId]: valor } }));

  const ponerPrecioSucursal = (sucursalId, tipoId, valor) =>
    setF((p) => ({
      ...p,
      sucursales: {
        ...p.sucursales,
        [sucursalId]: { precios: { ...p.sucursales[sucursalId].precios, [tipoId]: valor } },
      },
    }));

  const alternarExtra = (id) =>
    set('extraIds', f.extraIds.includes(id) ? f.extraIds.filter((x) => x !== id) : [...f.extraIds, id]);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    if (tiposConPrecio.length === 0) {
      setError('Pon el precio de al menos un tipo de artículo');
      return;
    }
    if (Object.keys(f.sucursales).length === 0) {
      setError('Elige al menos una sucursal');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(armarDatos(f, { editando, tipos }));
      onCerrar();
    } catch (err) {
      setError(err.message);
      setDetalles((err.detalles || []).map((d) => ({ ...d, campo: d.campo.split('.')[0] })));
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-2xl"
      titulo={editando ? 'Editar servicio' : 'Nuevo servicio'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-servicio" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-servicio" onSubmit={enviar} className="space-y-6">
        <Seccion titulo="¿Qué servicio ofreces?">
          {editando && (
            <p className="text-sm text-neutral-500">
              SKU <span className="font-semibold text-neutral-800">{servicio.sku}</span>
            </p>
          )}
          <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          <Selector etiqueta="Departamento *" value={f.departamentoId} onChange={(e) => set('departamentoId', e.target.value)} required>
            {opciones.departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.codigo} · {d.nombre}
              </option>
            ))}
          </Selector>
        </Seccion>

        <Seccion titulo="¿Cuánto cuesta?">
          <p className="text-sm text-neutral-500 -mt-2">
            Pon el precio de cada tipo de artículo. Deja vacío el que no aceptas.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {tipos.map((t) => (
              <Campo
                key={t.id}
                etiqueta={t.nombre}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={f.precios[t.id] ?? ''}
                placeholder="No se ofrece"
                onChange={(e) => ponerPrecio(String(t.id), e.target.value)}
              />
            ))}
          </div>
          <Campo
            etiqueta="¿En cuántos días se entrega? (opcional)"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            max="365"
            value={f.tiempoDias}
            onChange={(e) => set('tiempoDias', e.target.value)}
            ayuda="0 = el mismo día"
          />
        </Seccion>

        <Seccion titulo="¿Tiene extras?">
          {opciones.extras.length === 0 ? (
            <p className="text-sm text-neutral-400">Aún no hay extras. Créalos en la sección Extras.</p>
          ) : (
            <div className="space-y-1">
              {opciones.extras.map((x) => (
                <label key={x.id} className="flex items-center gap-3 min-h-11">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--c-primario)]"
                    checked={f.extraIds.includes(x.id)}
                    onChange={() => alternarExtra(x.id)}
                  />
                  <span className="flex-1">{x.nombre}</span>
                  <span className="text-sm text-neutral-400">{formatearMoneda(x.precio, empresa.moneda)}</span>
                </label>
              ))}
            </div>
          )}
        </Seccion>

        <Seccion titulo="¿En qué sucursales se ofrece?">
          <EditorSucursalesServicio
            sucursales={opciones.sucursales}
            valor={f.sucursales}
            onCambiar={(v) => set('sucursales', v)}
            tipos={tiposConPrecio}
            preciosGenerales={f.precios}
            onPrecio={ponerPrecioSucursal}
            moneda={empresa.moneda}
          />
        </Seccion>

        <Plegable titulo="Más opciones">
          <Selector etiqueta="IVA" value={f.tasaIvaId} onChange={(e) => set('tasaIvaId', e.target.value)}>
            {opciones.tasasIva.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} ({t.porcentaje}%)
              </option>
            ))}
          </Selector>
          <Interruptor
            etiqueta="Mostrar en la pantalla pública"
            descripcion="Los visitantes lo ven en el catálogo de su sucursal."
            valor={f.visiblePublico}
            onCambiar={(v) => set('visiblePublico', v)}
          />
        </Plegable>

        <MensajeError error={error} detalles={detalles} etiquetas={ETIQUETAS} />
      </form>
    </Modal>
  );
}