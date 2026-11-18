import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { configurarAlExpirar } from '../utils/apiFetch.js';
import * as authService from '../services/auth.service.js';
import * as empresaService from '../services/empresa.service.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [empresa, setEmpresa] = useState(null);
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorEmpresa, setErrorEmpresa] = useState('');

  const salir = useCallback(() => {
    localStorage.removeItem('token');
    setSesion(null);
  }, []);

  useEffect(() => {
    configurarAlExpirar(salir);
  }, [salir]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const e = await empresaService.obtener();
        if (!vivo) return;
        setEmpresa(e);
        document.title = e.nombre;
        if (localStorage.getItem('token')) {
          try {
            const s = await authService.yo();
            if (vivo) setSesion({ usuario: s.usuario, sucursales: s.sucursales, modulos: s.modulos ?? [] });
          } catch {
            localStorage.removeItem('token');
          }
        }
      } catch (err) {
        if (vivo) setErrorEmpresa(err.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = async (usuario, password) => {
    localStorage.removeItem('token');
    const r = await authService.login(usuario, password);
    localStorage.setItem('token', r.token);
    setSesion({ usuario: r.usuario, sucursales: r.sucursales, modulos: r.modulos ?? [] });
    return r.usuario;
  };

  const modulos = sesion?.modulos ?? [];

  return (
    <Ctx.Provider
      value={{
        empresa,
        usuario: sesion?.usuario ?? null,
        sucursales: sesion?.sucursales ?? [],
        // Claves de los módulos que la empresa tiene encendidos (solo ocultan opciones; el servidor decide)
        modulos,
        tieneModulo: (clave) => modulos.includes(clave),
        cargando,
        errorEmpresa,
        entrar,
        salir,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}