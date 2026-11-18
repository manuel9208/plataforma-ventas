import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../../services/modulosGlobal.service.js';

// Módulos de una empresa con su costo y el total mensual
export function useModulos(empresaId) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setDatos(await svc.listar(empresaId));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El servidor responde con todo recalculado (costos y total)
  const guardar = async (clave, cambios) => {
    setDatos(await svc.guardar(empresaId, clave, cambios));
  };

  return { datos, cargando, error, recargar: cargar, guardar };
}