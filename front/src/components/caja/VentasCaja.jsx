import { useState } from 'react';
import { useVentas } from './useVentas.js';
import ListaVentas from './ListaVentas.jsx';
import DetalleVenta from './DetalleVenta.jsx';

// Lista de ventas de mostrador y, al tocar una, su detalle. La lista conserva la búsqueda al volver.
export default function VentasCaja({ onOperando }) {
  const lista = useVentas();
  const [abierta, setAbierta] = useState(null);

  if (abierta) {
    return (
      <DetalleVenta
        key={abierta}
        id={abierta}
        onOperando={onOperando}
        onVolver={() => {
          setAbierta(null);
          lista.recargar();
        }}
      />
    );
  }
  return <ListaVentas lista={lista} onAbrir={(v) => setAbierta(v.id)} />;
}