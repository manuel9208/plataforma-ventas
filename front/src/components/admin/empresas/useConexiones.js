import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../../services/conexionesGlobal.service.js';

// Conexiones y llaves de una empresa. alcance: null = toda la empresa, o el id de una sucursal.
export function useConexiones(empresaId) {
  const [alcance, setAlcance] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await svc.listar(empresaId, alcance ?? undefined));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [empresaId, alcance]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El servidor responde con todo ya actualizado
  const guardar = async (grupo, valores) => setDatos(await svc.guardar(empresaId, grupo, alcance ?? undefined, valores));
  const quitar = async (grupo) => setDatos(await svc.quitar(empresaId, grupo, alcance));
  const revelar = async (clave) => (await svc.revelar(empresaId, clave, alcance ?? undefined)).valor;

  return { alcance, cambiarAlcance: setAlcance, datos, cargando, error, recargar: cargar, guardar, quitar, revelar };
}