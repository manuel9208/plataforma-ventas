import { useState } from 'react';
import Icono from '../../shared/Icono.jsx';
import SucursalesEmpresa from './SucursalesEmpresa.jsx';
import ModulosEmpresa from './ModulosEmpresa.jsx';
import ConexionesEmpresa from './ConexionesEmpresa.jsx';

// Para agregar una sección nueva: un archivo y una línea aquí
const SECCIONES = [
  { id: 'sucursales', nombre: 'Sucursales', componente: SucursalesEmpresa },
  { id: 'modulos', nombre: 'Módulos', componente: ModulosEmpresa },
  { id: 'conexiones', nombre: 'Conexiones', componente: ConexionesEmpresa },
];

export default function DetalleEmpresa({ empresa, onVolver }) {
  const [activa, setActiva] = useState(SECCIONES[0].id);
  const Seccion = SECCIONES.find((s) => s.id === activa).componente;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1 min-h-11 pr-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <Icono nombre="atras" className="size-5" />
          Empresas
        </button>
        <h2 className="text-xl font-semibold tracking-tight">{empresa.nombre}</h2>
        <span className="text-sm text-neutral-400">{empresa.slug}</span>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiva(s.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              s.id === activa ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-[var(--c-borde)]'
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <Seccion empresa={empresa} empresaId={empresa.id} />
    </div>
  );
}