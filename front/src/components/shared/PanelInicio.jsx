import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { MODULOS } from '../../config/modulosSistema.js';
import { puedeEntrarA, tienePermiso } from '../../utils/permisos.js';
import EncabezadoApp from './EncabezadoApp.jsx';
import Icono from './Icono.jsx';

const TARJETA_CAJA = { id: 'caja', nombre: 'Caja', descripcion: 'Notas, cobros y entregas', icono: 'caja', ruta: '/caja' };

const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function PanelInicio() {
  const { usuario, empresa, tieneModulo } = useAuth();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  const tarjetas = useMemo(() => {
    const esAdmin = puedeEntrarA(usuario, 'admin');
    const lista = MODULOS.filter(
      (m) =>
        (esAdmin || m.paraTodos) &&
        m.rolesPermitidos.includes(usuario.rol) &&
        (!m.permiso || tienePermiso(usuario.permisos, m.permiso)) &&
        (!m.giros || m.giros.includes(empresa.tipoNegocio)) &&
        (!m.modulo || tieneModulo(m.modulo))
    );
    if (puedeEntrarA(usuario, 'caja')) lista.push(TARJETA_CAJA);
    return lista;
  }, [usuario, empresa, tieneModulo]);

  const q = normalizar(busqueda.trim());
  const visibles = q ? tarjetas.filter((m) => normalizar(`${m.nombre} ${m.descripcion}`).includes(q)) : tarjetas;

  return (
    <>
      <EncabezadoApp titulo="Inicio" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {saludo()}, {usuario.nombre.split(' ')[0]}
        </h2>
        <p className="text-neutral-500 mt-1">¿Qué quieres hacer hoy?</p>

        <form
          className="relative mt-6 max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (visibles[0]) navigate(visibles[0].ruta);
          }}
        >
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icono nombre="buscar" className="size-5" />
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar una opción… (Enter para abrir)"
            className="w-full min-h-14 pl-12 pr-4 rounded-2xl bg-white border border-[var(--c-borde)] text-base outline-none transition shadow-[0_10px_30px_-18px_rgba(22,29,51,0.35)] focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
          />
        </form>

        {tarjetas.length === 0 ? (
          <p className="text-neutral-400 mt-10">No tienes módulos asignados.</p>
        ) : visibles.length === 0 ? (
          <p className="text-neutral-400 mt-10">No encontramos opciones con "{busqueda}".</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {visibles.map((m) => (
              <Link
                key={m.id}
                to={m.ruta}
                className="group rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_1px_2px_rgba(22,29,51,0.04),0_14px_30px_-18px_rgba(22,29,51,0.25)] transition hover:-translate-y-0.5 hover:border-[var(--c-acento)]/60 active:scale-[0.98]"
              >
                <span className="grid place-items-center size-12 rounded-2xl text-[var(--c-acento)] bg-[linear-gradient(135deg,var(--c-primario-2),var(--c-primario))] shadow-[0_8px_18px_-8px_rgba(29,43,79,0.7)]">
                  <Icono nombre={m.icono} className="size-6" />
                </span>
                <p className="mt-4 font-semibold tracking-tight">{m.nombre}</p>
                <p className="text-sm text-neutral-500 mt-0.5">{m.descripcion}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}