import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CLAVE_TOKEN, configurarAlExpirarCliente } from '../utils/apiFetch.js';
import * as svc from '../services/miCuenta.service.js';

const CLAVE = CLAVE_TOKEN.cliente;
const Ctx = createContext(null);
export const useCliente = () => useContext(Ctx);

// Sesión del cliente: independiente de la del empleado
export function ClienteProvider({ children }) {
  const [cliente, setCliente] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(localStorage.getItem(CLAVE)));

  const salir = useCallback(() => {
    localStorage.removeItem(CLAVE);
    setCliente(null);
  }, []);

  useEffect(() => {
    configurarAlExpirarCliente(salir);
  }, [salir]);

  useEffect(() => {
    if (!localStorage.getItem(CLAVE)) return undefined;
    let vivo = true;
    svc
      .yo()
      .then((c) => vivo && setCliente(c))
      .catch(() => {})
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = async (telefono, pin) => {
    localStorage.removeItem(CLAVE);
    const r = await svc.login(telefono, pin);
    localStorage.setItem(CLAVE, r.token);
    setCliente(r.cliente);
    return r.cliente;
  };

  const aceptarAviso = async () => setCliente(await svc.aceptarAviso());

  return (
    <Ctx.Provider
      value={{
        cliente,
        cargando,
        entrar,
        salir,
        aceptarAviso,
        actualizar: setCliente,
        // Cambiar el PIN deja sin efecto la sesión anterior: el servidor manda una nueva
        guardarToken: (token) => localStorage.setItem(CLAVE, token),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}