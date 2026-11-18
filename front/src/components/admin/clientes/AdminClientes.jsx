import { useState } from 'react';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import GestorClientes from './GestorClientes.jsx';

// Para agregar una sección nueva: un archivo y una línea aquí
const SECCIONES = [{ id: 'lista', nombre: 'Clientes', componente: GestorClientes }];

export default function AdminClientes() {
  const [activa, setActiva] = useState(SECCIONES[0].id);
  const Seccion = SECCIONES.find((s) => s.id === activa).componente;

  return (
    <>
      <EncabezadoApp titulo="Clientes" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-24">
        {SECCIONES.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiva(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  s.id === activa ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-[var(--c-borde)]'
                }`}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
        <Seccion />
      </main>
    </>
  );
}