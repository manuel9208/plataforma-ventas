import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function EncabezadoApp({ titulo, atras }) {
  const { empresa, salir } = useAuth();
  return (
    <header className="sticky top-0 z-40 text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))] shadow-[0_10px_30px_-14px_rgba(19,28,51,0.7)]">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-3">
        {atras && (
          <Link
            to={atras}
            aria-label="Volver"
            className="size-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-lg transition"
          >
            ‹
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold tracking-tight truncate">{titulo}</h1>
          <p className="text-xs text-white/60 truncate">{empresa?.nombre}</p>
        </div>
        <Link to="/perfil" className="text-sm font-medium text-white/80 hover:text-white">
          Perfil
        </Link>
        <button onClick={salir} className="text-sm font-medium text-[var(--c-acento)]">
          Salir
        </button>
      </div>
      <div className="h-px bg-[linear-gradient(90deg,transparent,var(--c-acento),transparent)] opacity-60" />
    </header>
  );
}