import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../../services/configuracion.service.js';

// alcance: null = toda la empresa, o el id de una sucursal. El servidor decide qué se puede ver y cambiar.
export function useConfiguracion() {
  const [alcance, setAlcance] = useState(undefined); // undefined = lo decide el servidor al entrar
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await svc.obtener(alcance ?? undefined);
      setDatos(r);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [alcance]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El servidor responde con todo ya actualizado
  const guardarAjustes = async (valores) => setDatos(await svc.guardarAjustes(datos.alcance ?? undefined, valores));
  const guardarSucursal = async (cambios) => setDatos(await svc.guardarSucursal(datos.alcance, cambios));

  return {
    datos,
    cargando,
    error,
    cambiarAlcance: (valor) => setAlcance(valor),
    recargar: cargar,
    guardarAjustes,
    guardarSucursal,
  };
}