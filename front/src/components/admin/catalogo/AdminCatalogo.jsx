import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import SeccionDepartamentos from './SeccionDepartamentos.jsx';
import SeccionTiposArticulo from './SeccionTiposArticulo.jsx';
import SeccionIva from './SeccionIva.jsx';

// "giros": si se indica, la sección solo aparece en esos tipos de negocio.
// Para agregar una sección nueva: un archivo y una línea aquí.
const SECCIONES = [
  { id: 'departamentos', nombre: 'Departamentos', componente: SeccionDepartamentos },
  { id: 'tipos', nombre: 'Tipos de artículo', componente: SeccionTiposArticulo, giros: ['limpieza'] },
  { id: 'iva', nombre: 'IVA', componente: SeccionIva },
];

export default function AdminCatalogo() {
  const { empresa } = useAuth();
  const visibles = SECCIONES.filter((s) => !s.giros || s.giros.includes(empresa.tipoNegocio));
  const [activa, setActiva] = useState(visibles[0].id);
  const Seccion = visibles.find((s) => s.id === activa).componente;

  return (
    <>
      <EncabezadoApp titulo="Catálogo" atras="/panel" />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-24">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {visibles.map((s) => (
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