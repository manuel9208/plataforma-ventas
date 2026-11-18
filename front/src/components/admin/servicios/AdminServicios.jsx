import { useState } from 'react';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import GestorServicios from './GestorServicios.jsx';
import GestorExtras from './GestorExtras.jsx';

// Para agregar una sección nueva: un archivo y una línea aquí
const SECCIONES = [
  { id: 'servicios', nombre: 'Servicios', componente: GestorServicios },
  { id: 'extras', nombre: 'Extras', componente: GestorExtras },
];

export default function AdminServicios() {
  const [activa, setActiva] = useState(SECCIONES[0].id);
  const Seccion = SECCIONES.find((s) => s.id === activa).componente;

  return (
    <>
      <EncabezadoApp titulo="Servicios" atras="/panel" />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-24">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiva(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                s.id === activa ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-neutral-200'
              }`}
            >
              {s.nombre}
            </button>
          ))}
        </div>
        <Seccion />
      </main>
    </>
  );
}