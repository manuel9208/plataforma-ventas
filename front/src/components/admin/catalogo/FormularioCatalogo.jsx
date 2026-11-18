import { useState } from 'react';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

// Formulario genérico: se arma con la lista "campos" que le pasa cada sección
export default function FormularioCatalogo({ titulo, campos, item, onGuardar, onCerrar }) {
  const [f, setF] = useState(() =>
    Object.fromEntries(campos.map((c) => [c.clave, item?.[c.clave] ?? c.defecto ?? '']))
  );
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const etiquetas = Object.fromEntries(campos.map((c) => [c.clave, c.etiqueta.replace(' *', '')]));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    setGuardando(true);
    try {
      const datos = {};
      for (const c of campos) {
        datos[c.clave] = c.tipo === 'numero' ? Number(f[c.clave]) : String(f[c.clave]).trim();
      }
      await onGuardar(datos);
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
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-catalogo" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-catalogo" onSubmit={enviar} className="space-y-4">
        {campos.map((c) => (
          <Campo
            key={c.clave}
            etiqueta={c.etiqueta}
            ayuda={c.ayuda}
            type={c.tipo === 'numero' ? 'number' : 'text'}
            inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
            step={c.paso}
            min={c.min}
            max={c.max}
            value={f[c.clave]}
            onChange={(e) => setF((p) => ({ ...p, [c.clave]: e.target.value }))}
            required={c.requerido}
          />
        ))}
        <MensajeError error={error} detalles={detalles} etiquetas={etiquetas} />
      </form>
    </Modal>
  );
}