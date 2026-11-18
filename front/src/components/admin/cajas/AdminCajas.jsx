import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { tienePermiso } from '../../../utils/permisos.js';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import GestorCajas from './GestorCajas.jsx';
import AsignacionCajas from './AsignacionCajas.jsx';
import TurnosAbiertos from './TurnosAbiertos.jsx';
import CortesCaja from './CortesCaja.jsx';

// Para agregar una sección nueva: un archivo y una línea aquí. "permiso" es opcional.
const SECCIONES = [
  { id: 'cajas', nombre: 'Cajas', componente: GestorCajas },
  { id: 'asignacion', nombre: 'Quién usa cada caja', componente: AsignacionCajas },
  { id: 'turnos', nombre: 'Turnos abiertos', componente: TurnosAbiertos },
  { id: 'cortes', nombre: 'Cortes', componente: CortesCaja, permiso: 'caja.corte_completo' },
];

export default function AdminCajas() {
  const { usuario } = useAuth();
  const visibles = SECCIONES.filter((s) => !s.permiso || usuario.rol === 'adminglobal' || tienePermiso(usuario.permisos, s.permiso));
  const [activa, setActiva] = useState(visibles[0].id);
  const Seccion = (visibles.find((s) => s.id === activa) ?? visibles[0]).componente;

  return (
    <>
      <EncabezadoApp titulo="Cajas" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-24">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {visibles.map((s) => (
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
        <Seccion />
      </main>
    </>
  );
}