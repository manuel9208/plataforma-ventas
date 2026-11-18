import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import Plegable from '../../shared/Plegable.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const ETIQUETAS = { nombre: 'Nombre', precio: 'Precio', tasaIvaId: 'IVA', preciosSucursal: 'Precios por sucursal' };

export default function FormularioExtra({ extra, opciones, onGuardar, onCerrar }) {
  const { empresa } = useAuth();
  const editando = !!extra;
  const tasaDefecto = opciones.tasasIva.find((t) => t.esDefecto) ?? opciones.tasasIva[0];

  const [f, setF] = useState(() => ({
    nombre: extra?.nombre ?? '',
    precio: extra ? String(extra.precio) : '',
    tasaIvaId: String(extra?.tasaIvaId ?? tasaDefecto?.id ?? ''),
    preciosSucursal: Object.fromEntries(Object.entries(extra?.preciosSucursal ?? {}).map(([sid, v]) => [sid, String(v)])),
  }));
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    setGuardando(true);
    try {
      const preciosSucursal = Object.fromEntries(
        Object.entries(f.preciosSucursal)
          .filter(([, v]) => v !== '')
          .map(([sid, v]) => [sid, Number(v)])
      );
      await onGuardar({
        nombre: f.nombre.trim(),
        precio: Number(f.precio),
        tasaIvaId: Number(f.tasaIvaId),
        preciosSucursal,
      });
      onCerrar();
    } catch (err) {
      setError(err.message);
      setDetalles((err.detalles || []).map((d) => ({ ...d, campo: d.campo.split('.')[0] })));
      setGuardando(false);
    }
  };

  const hayPreciosPropios = Object.values(f.preciosSucursal).some((v) => v !== '');

  return (
    <Modal
      abierto
      titulo={editando ? 'Editar extra' : 'Nuevo extra'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-extra" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-extra" onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Impermeabilizante, Entrega a domicilio…" required />
        <Campo
          etiqueta="Precio *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={f.precio}
          onChange={(e) => set('precio', e.target.value)}
          required
        />

        {opciones.sucursales.length > 0 && (
          <Plegable titulo="Precio distinto por sucursal" abiertaInicial={hayPreciosPropios}>
            {opciones.sucursales.map((s) => (
              <Campo
                key={s.id}
                etiqueta={s.nombre}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={f.preciosSucursal[s.id] ?? ''}
                placeholder={f.precio === '' ? 'Igual al general' : `Igual al general (${formatearMoneda(f.precio, empresa.moneda)})`}
                onChange={(e) => set('preciosSucursal', { ...f.preciosSucursal, [s.id]: e.target.value })}
                ayuda="Vacío = usa el precio general"
              />
            ))}
          </Plegable>
        )}

        <Plegable titulo="Más opciones">
          <Selector etiqueta="IVA" value={f.tasaIvaId} onChange={(e) => set('tasaIvaId', e.target.value)}>
            {opciones.tasasIva.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} ({t.porcentaje}%)
              </option>
            ))}
          </Selector>
        </Plegable>

        <MensajeError error={error} detalles={detalles} etiquetas={ETIQUETAS} />
      </form>
    </Modal>
  );
}