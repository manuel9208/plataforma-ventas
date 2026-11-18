import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/turnos.service.js';

export function useTurno() {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ultimoCierre, setUltimoCierre] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await svc.actual());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    estado,
    cargando,
    error,
    ultimoCierre,
    abrir: async (fondo) => {
      setUltimoCierre(null);
      setEstado(await svc.abrir(fondo));
    },
    cerrar: async (id, datos) => {
      setUltimoCierre(await svc.cerrar(id, datos));
      await cargar();
    },
  };
}