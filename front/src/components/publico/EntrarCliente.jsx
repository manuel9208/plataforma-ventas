import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCliente } from '../../context/ClienteContext.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import MensajeError from '../shared/MensajeError.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function EntrarCliente() {
  const { empresa } = useAuth();
  const { cliente, entrar } = useCliente();
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (cliente) return <Navigate to="/mi-cuenta" replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await entrar(telefono, pin);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-10">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm bg-white rounded-[28px] p-7 border border-[var(--c-borde)] shadow-[0_30px_80px_-30px_rgba(22,29,51,0.35)]"
      >
        <p className="text-center text-xs tracking-[0.3em] uppercase text-[var(--c-acento)] mb-2">{empresa.nombre}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-center">Mi cuenta</h1>
        <p className="text-neutral-500 text-center mt-1 mb-6">Entra con tu teléfono y tu PIN</p>

        <Campo
          etiqueta="Teléfono"
          type="tel"
          inputMode="numeric"
          placeholder="10 dígitos"
          value={telefono}
          onChange={(e) => setTelefono(soloDigitos(e.target.value, 10))}
          autoComplete="tel"
          required
        />
        <Campo
          className="mt-4"
          etiqueta="PIN"
          type="password"
          inputMode="numeric"
          placeholder="4 dígitos"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(soloDigitos(e.target.value, 4))}
          autoComplete="current-password"
          required
        />
        <p className="mt-2 text-xs text-neutral-500">¿Aún no tienes PIN? Pídelo en tu sucursal.</p>

        <div className="mt-4">
          <MensajeError error={error} />
        </div>

        <Boton type="submit" cargando={cargando} disabled={telefono.length !== 10 || pin.length !== 4} className="w-full mt-6">
          Entrar
        </Boton>
        <Link to="/" className="block text-center text-sm text-neutral-500 mt-4 hover:text-neutral-800">
          Volver al inicio
        </Link>
      </form>
    </div>
  );
}