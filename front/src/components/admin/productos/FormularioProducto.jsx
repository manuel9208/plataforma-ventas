import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import Plegable from '../../shared/Plegable.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import CamposPresentacion from './CamposPresentacion.jsx';
import EditorPresentaciones from './EditorPresentaciones.jsx';
import EditorSucursales from './EditorSucursales.jsx';
import { estadoInicial, armarDatos } from './productoForm.js';

const ETIQUETAS = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  marca: 'Marca',
  departamentoId: 'Departamento',
  tasaIvaId: 'IVA',
  unidadBase: 'Cómo se vende',
  presentaciones: 'Precios y presentaciones',
  sucursales: 'Sucursales',
};

const Seccion = ({ titulo, children }) => (
  <div className="space-y-4">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 pt-2">{titulo}</h3>
    {children}
  </div>
);

export default function FormularioProducto({ producto, opciones, onGuardar, onCerrar }) {
  const { empresa } = useAuth();
  const editando = !!producto;
  const [f, setF] = useState(() => estadoInicial(producto, opciones));
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const nombreUnidad = (c) => opciones.unidades.find((u) => u.clave === c)?.nombre ?? c;
  const base = f.presentaciones.find((p) => p.esBase);

  const actualizarBase = (cambios) =>
    set('presentaciones', f.presentaciones.map((p) => (p.esBase ? { ...p, ...cambios } : p)));

  // La presentación principal siempre usa la forma de venta elegida arriba
  const cambiarUnidadBase = (nueva) =>
    setF((p) => ({
      ...p,
      unidadBase: nueva,
      presentaciones: p.presentaciones.map((x) =>
        x.esBase ? { ...x, unidad: nueva, factor: '1', nombre: nombreUnidad(nueva) } : x
      ),
    }));

  const ponerPrecioSucursal = (clavePresentacion, sucursalId, valor) =>
    set(
      'presentaciones',
      f.presentaciones.map((p) =>
        p._k === clavePresentacion ? { ...p, preciosSucursal: { ...p.preciosSucursal, [sucursalId]: valor } } : p
      )
    );

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    if (Object.keys(f.sucursales).length === 0) {
      setError('Elige al menos una sucursal');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(armarDatos(f, { editando }));
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
      titulo={editando ? 'Editar producto' : 'Nuevo producto'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-producto" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-producto" onSubmit={enviar} className="space-y-6">
        <Seccion titulo="¿Qué vendes?">
          {editando && (
            <p className="text-sm text-neutral-500">
              SKU <span className="font-semibold text-neutral-800">{producto.sku}</span>
            </p>
          )}
          <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          <Campo etiqueta="Marca (opcional)" value={f.marca} onChange={(e) => set('marca', e.target.value)} />
          <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          <Selector etiqueta="Departamento *" value={f.departamentoId} onChange={(e) => set('departamentoId', e.target.value)} required>
            {opciones.departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.codigo} · {d.nombre}
              </option>
            ))}
          </Selector>
          <div>
            <Selector etiqueta="¿Cómo se vende? *" value={f.unidadBase} onChange={(e) => cambiarUnidadBase(e.target.value)} required>
              {opciones.unidades.map((u) => (
                <option key={u.clave} value={u.clave}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
            <p className="text-xs text-neutral-500 mt-1">Por pieza, por kilo, por litro…</p>
          </div>
          <CamposPresentacion
            p={base}
            onCambiar={actualizarBase}
            unidad={nombreUnidad(f.unidadBase).toLowerCase()}
            etiquetaPrecio={`Precio por ${nombreUnidad(f.unidadBase).toLowerCase()} *`}
          />
        </Seccion>

        <Seccion titulo="¿También lo vendes en caja, cartón o paquete?">
          <EditorPresentaciones
            valor={f.presentaciones}
            onCambiar={(v) => set('presentaciones', v)}
            unidades={opciones.unidades}
            unidadBase={f.unidadBase}
          />
        </Seccion>

        <Seccion titulo="¿En qué sucursales se vende?">
          <EditorSucursales
            sucursales={opciones.sucursales}
            valor={f.sucursales}
            onCambiar={(v) => set('sucursales', v)}
            presentaciones={f.presentaciones}
            onPrecio={ponerPrecioSucursal}
            unidadNombre={nombreUnidad(f.unidadBase)}
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
          <Interruptor
            etiqueta="Controlar inventario"
            descripcion="Descuenta la existencia cuando se vende."
            valor={f.controlaInventario}
            onCambiar={(v) => set('controlaInventario', v)}
          />
        </Plegable>

        <MensajeError error={error} detalles={detalles} etiquetas={ETIQUETAS} />
      </form>
    </Modal>
  );
}