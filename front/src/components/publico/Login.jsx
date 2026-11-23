import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { rutaInicio } from '../../utils/permisos.js';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

export default function Login() {
  const { empresa, usuario, entrar } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (usuario) return <Navigate to={rutaInicio(usuario)} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await entrar(u.trim(), p);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 text-white bg-[linear-gradient(160deg,var(--c-primario-2),var(--c-primario)_60%,#0f1830)]">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[var(--c-acento)]/15 blur-3xl" />
        <p className="relative text-sm tracking-[0.3em] uppercase text-[var(--c-acento)]">{empresa.nombre}</p>
        <div className="relative">
          <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.1]">
            Todo tu negocio,
            <br />
            en un solo lugar.
          </h2>
          <p className="mt-4 text-white/60 max-w-sm">Ventas, inventario y equipo, siempre a la mano.</p>
        </div>
        <p className="relative text-xs text-white/40">{empresa.nombre}</p>
      </div>

      <div className="grid place-items-center px-5 py-10">
        <form
          onSubmit={enviar}
          className="w-full max-w-sm bg-white rounded-[28px] p-7 border border-[var(--c-borde)] shadow-[0_30px_80px_-30px_rgba(22,29,51,0.35)]"
        >
          <p className="lg:hidden text-center text-xs tracking-[0.3em] uppercase text-[var(--c-acento)] mb-2">{empresa.nombre}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-center">Bienvenido</h1>
          <p className="text-neutral-500 text-center mt-1 mb-6">Inicia sesión para continuar</p>

          <Campo etiqueta="Teléfono" type="tel" inputMode="numeric" maxLength={10} placeholder="10 dígitos" value={u} onChange={(e) => setU(e.target.value.replace(/\D/g, '').slice(0, 10))} autoComplete="tel" required />
          <Campo className="mt-4" etiqueta="Contraseña" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />

          <div className="mt-4">
            <MensajeError error={error} />
          </div>

          <Boton type="submit" cargando={cargando} className="w-full mt-6">
            Entrar
          </Boton>
          <Link to="/" className="block text-center text-sm text-neutral-500 mt-4 hover:text-neutral-800">
            Volver al inicio
          </Link>
        </form>
      </div>
    </div>
  );
}