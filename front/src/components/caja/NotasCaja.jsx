import { useState } from 'react';
import { useNotas } from './useNotas.js';
import ListaNotas from './ListaNotas.jsx';
import DetalleNota from './DetalleNota.jsx';

// Lista de notas y, al tocar una, su detalle. La lista conserva pestaña y búsqueda al volver.
export default function NotasCaja({ onOperando }) {
  const lista = useNotas();
  const [abierta, setAbierta] = useState(null); // { id, accion }

  const volver = () => {
    setAbierta(null);
    lista.recargar();
  };

  if (abierta) {
    return <DetalleNota key={abierta.id} id={abierta.id} accionInicial={abierta.accion} onVolver={volver} onOperando={onOperando} />;
  }
  return <ListaNotas lista={lista} onAbrir={(nota, accion) => setAbierta({ id: nota.id, accion })} />;
}