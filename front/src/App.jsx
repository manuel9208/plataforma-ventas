import { Suspense, useEffect } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ClienteProvider } from './context/ClienteContext.jsx';
import { MODULOS } from './config/modulosSistema.js';
import RutaProtegida from './components/shared/RutaProtegida.jsx';
import Boton from './components/shared/Boton.jsx';
import Inicio from './components/publico/Inicio.jsx';
import Login from './components/publico/Login.jsx';
import EntrarCliente from './components/publico/EntrarCliente.jsx';
import MiCuenta from './components/cliente/MiCuenta.jsx';
import PanelInicio from './components/shared/PanelInicio.jsx';
import Caja from './components/caja/Caja.jsx';

const CLAVE_RUTA = 'ruta_actual';

// Guarda la pantalla actual (solo en esta pestaña) y mantiene la barra del navegador limpia
function GuardarRuta() {
  const { pathname } = useLocation();
  useEffect(() => {
    sessionStorage.setItem(CLAVE_RUTA, pathname);
    window.history.replaceState(null, '', '/');
  }, [pathname]);
  return null;
}

const Centro = ({ children }) => (
  <div className="min-h-dvh grid place-items-center px-4 text-center text-neutral-500">{children}</div>
);

export default function App() {
  const { cargando, errorEmpresa } = useAuth();

  if (cargando) return <Centro>Cargando…</Centro>;
  if (errorEmpresa) {
    return (
      <Centro>
        <div>
          <p className="mb-4">{errorEmpresa}</p>
          <Boton onClick={() => window.location.reload()}>Reintentar</Boton>
        </div>
      </Centro>
    );
  }

  return (
    <ClienteProvider>
    <MemoryRouter initialEntries={[sessionStorage.getItem(CLAVE_RUTA) || '/']}>
      <GuardarRuta />
      <Suspense fallback={<Centro>Cargando…</Centro>}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cliente" element={<EntrarCliente />} />
          <Route path="/mi-cuenta" element={<MiCuenta />} />
          <Route
            path="/panel"
            element={
              <RutaProtegida>
                <PanelInicio />
              </RutaProtegida>
            }
          />
          {MODULOS.map((m) => (
            <Route
              key={m.id}
              path={`${m.ruta}/*`}
              element={
                <RutaProtegida rolesPermitidos={m.rolesPermitidos} permiso={m.permiso}>
                  <m.componente />
                </RutaProtegida>
              }
            />
          ))}
          <Route
            path="/caja"
            element={
              <RutaProtegida permiso="pantalla.caja">
                <Caja />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </MemoryRouter>
    </ClienteProvider>
  );
}