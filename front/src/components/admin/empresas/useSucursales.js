import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../../services/sucursalesGlobal.service.js';

// Sucursales de una empresa
export function useSucursales(empresaId) {
  const [datos, setDatos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await svc.listar(empresaId);
      setDatos(r.datos);
      setEmpresa(r.empresa);
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

  return { datos, empresa, cargando, error, recargar: cargar };
}