import { useState } from 'react';
import { nombreUnidad } from '@plataforma/calculos';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';

export default function ModalCantidad({ producto, presentacion, onAceptar, onCerrar }) {
  const [cantidad, setCantidad] = useState('');
  const unidad = nombreUnidad(presentacion.unidad).toLowerCase();
  const valida = Number(cantidad) > 0;

  return (
    <Modal
      abierto
      titulo={producto.nombre}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-cantidad" className="flex-1" disabled={!valida}>
            Agregar
          </Boton>
        </>
      }
    >
      <form
        id="form-cantidad"
        onSubmit={(e) => {
          e.preventDefault();
          if (valida) onAceptar(Number(cantidad));
        }}
      >
        <Campo
          etiqueta={`¿Cuántos ${unidad}s? *`}
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          autoFocus
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          ayuda="Hasta 3 decimales"
        />
      </form>
    </Modal>
  );
}