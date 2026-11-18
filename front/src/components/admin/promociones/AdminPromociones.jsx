import { useState } from 'react';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import SeccionPromociones from './SeccionPromociones.jsx';

// Para agregar una sección (puntos, sellos...): un archivo y una línea aquí
const SECCIONES = [{ id: 'promociones', nombre: 'Promociones', componente: SeccionPromociones }];

export default function AdminPromociones() {
  const [activa, setActiva] = useState(SECCIONES[0].id);
  const Seccion = SECCIONES.find((s) => s.id === activa).componente;

  return (
    <>
      <EncabezadoApp titulo="Promociones" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-24">
        {SECCIONES.length > 1 && (
          <Segmentos className="mb-4" opciones={SECCIONES.map(({ id, nombre }) => ({ id, nombre }))} valor={activa} onCambio={setActiva} />
        )}
        <Seccion />
      </main>
    </>
  );
}