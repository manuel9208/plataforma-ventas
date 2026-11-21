import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCliente } from '../../context/ClienteContext.jsx';
import ModalAvisoPrivacidad from './ModalAvisoPrivacidad.jsx';
import SeccionPedidos from './SeccionPedidos.jsx';
import SeccionCompras from './SeccionCompras.jsx';
import SeccionPuntos from './SeccionPuntos.jsx';
import SeccionDatos from './SeccionDatos.jsx';
import SeccionPin from './SeccionPin.jsx';

const CONTENEDOR = 'w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10';

// Para agregar una sección nueva (puntos, cupones, sellos): un archivo y una línea aquí
const SECCIONES = [
  { id: 'pedidos', nombre: 'Mis pedidos', componente: SeccionPedidos },
  { id: 'compras', nombre: 'Mis compras', componente: SeccionCompras },
  { id: 'puntos', nombre: 'Mis puntos', componente: SeccionPuntos },
  { id: 'datos', nombre: 'Mis datos', componente: SeccionDatos },
  { id: 'pin', nombre: 'Mi PIN', componente: SeccionPin },
];

export default function MiCuenta() {
  const { empresa } = useAuth();
  const { cliente, cargando, salir } = useCliente();
  const navegar = useNavigate();
  const [activa, setActiva] = useState(SECCIONES[0].id);

  if (cargando) return <div className="min-h-dvh grid place-items-center text-neutral-500">Cargando…</div>;
  if (!cliente) return <Navigate to="/cliente" replace />;

  const Seccion = SECCIONES.find((s) => s.id === activa).componente;
  const primerNombre = cliente.nombre.trim().split(' ')[0];

  return (
    <div className="min-h-dvh">
      <header className="text-white bg-[linear-gradient(160deg,var(--c-primario-2),var(--c-primario)_65%,#0f1830)]">
        <div className={`${CONTENEDOR} h-16 flex items-center justify-between gap-3`}>
          <Link to="/" className="font-semibold tracking-tight truncate">
            {empresa.nombre}
          </Link>
          <button
            type="button"
            onClick={() => {
              salir();
              navegar('/');
            }}
            className="px-4 min-h-10 rounded-full bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/20 transition"
          >
            Salir
          </button>
        </div>
        <div className={`${CONTENEDOR} pb-8`}>
          <p className="text-xs tracking-[0.3em] uppercase text-[var(--c-acento)]">Mi cuenta</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Hola, {primerNombre}</h1>
        </div>
      </header>

      <main className={`${CONTENEDOR} py-6 pb-24`}>
        {!cliente.perfil.completo && activa !== 'datos' && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
            <span>Completa tu perfil: falta {cliente.perfil.falta.join(', ')}.</span>
            <button type="button" onClick={() => setActiva('datos')} className="font-semibold underline underline-offset-2 shrink-0">
              Completar
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiva(s.id)}
              className={`px-4 min-h-10 rounded-full text-sm font-medium whitespace-nowrap ${
                s.id === activa ? 'bg-[var(--c-primario)] text-white' : 'bg-white border border-[var(--c-borde)]'
              }`}
            >
              {s.nombre}
            </button>
          ))}
        </div>

        <Seccion />
      </main>

      {cliente.avisoPendiente && <ModalAvisoPrivacidad />}
    </div>
  );
}