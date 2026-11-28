import { useEffect, useState } from 'react';
import * as cuentaService from '../../../services/cuentaGlobal.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import CuentaEmpleado from './CuentaEmpleado.jsx';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

function CuentaGlobal() {
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cuentaService
      .obtener()
      .then((c) => setF({ nombre: c.nombre, telefono: c.telefono, password: '', passwordActual: '' }))
      .catch((e) => setError(e.message));
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setGuardando(true);
    try {
      const datos = { nombre: f.nombre.trim(), telefono: f.telefono };
      if (f.password) datos.password = f.password;
      if (f.passwordActual) datos.passwordActual = f.passwordActual;
      const c = await cuentaService.actualizar(datos);
      setF({ nombre: c.nombre, telefono: c.telefono, password: '', passwordActual: '' });
      setOk('Datos guardados');
    } catch (err) {
      setError([err.message, ...(err.detalles || []).map((d) => `${d.campo}: ${d.mensaje}`)].join(' · '));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <EncabezadoApp titulo="Mi cuenta" atras="/panel" />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-24">
        {!f ? (
          <p className="text-center text-neutral-400 py-10">{error || 'Cargando…'}</p>
        ) : (
          <form onSubmit={enviar} className="space-y-4 max-w-lg">
            <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            <Campo
              etiqueta="Teléfono *"
              type="tel"
              inputMode="numeric"
              value={f.telefono}
              onChange={(e) => set('telefono', soloDigitos(e.target.value, 13))}
              required
            />
            <Campo
              etiqueta="Nueva contraseña (opcional)"
              type="password"
              value={f.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres"
            />
            <Campo
              etiqueta="Contraseña actual"
              type="password"
              value={f.passwordActual}
              onChange={(e) => set('passwordActual', e.target.value)}
              autoComplete="current-password"
              ayuda="Solo si cambias teléfono o contraseña"
            />
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            {ok && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{ok}</p>}
            <Boton type="submit" cargando={guardando} className="w-full">
              Guardar cambios
            </Boton>
          </form>
        )}
      </main>
    </>
  );
}

// El AdminGlobal conserva su pantalla; cualquier empleado ve la suya
export default function AdminCuenta() {
  const { usuario } = useAuth();
  return usuario?.rol === 'adminglobal' ? <CuentaGlobal /> : <CuentaEmpleado />;
}