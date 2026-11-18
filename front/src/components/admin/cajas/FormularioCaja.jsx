import { useState } from 'react';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

export default function FormularioCaja({ caja, sucursales, onGuardar, onCerrar }) {
  const editando = !!caja;
  const [nombre, setNombre] = useState(caja?.nombre ?? '');
  const [sucursalId, setSucursalId] = useState(String(sucursales[0]?.id ?? ''));
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    setGuardando(true);
    try {
      await onGuardar(editando ? { nombre: nombre.trim() } : { sucursalId: Number(sucursalId), nombre: nombre.trim() });
      onCerrar();
    } catch (err) {
      setError(err.message);
      setDetalles(err.detalles || []);
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={editando ? 'Editar caja' : 'Nueva caja'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-caja" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-caja" onSubmit={enviar} className="space-y-4">
        {editando ? (
          <p className="text-sm text-neutral-500">
            Sucursal <span className="font-semibold text-neutral-800">{caja.sucursal}</span>
          </p>
        ) : (
          <Selector etiqueta="Sucursal *" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Selector>
        )}
        <Campo etiqueta="Nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Caja 2, Mostrador…" required />
        <MensajeError error={error} detalles={detalles} etiquetas={{ nombre: 'Nombre', sucursalId: 'Sucursal' }} />
      </form>
    </Modal>
  );
}