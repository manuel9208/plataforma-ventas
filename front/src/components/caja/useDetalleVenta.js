import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/ventasMostrador.service.js';

export function useDetalleVenta(id) {
  const [venta, setVenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    svc
      .obtener(id)
      .then((v) => {
        if (!vivo) return;
        setVenta(v);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [id]);

  const recargar = useCallback(async () => {
    try {
      setVenta(await svc.obtener(id));
      setError('');
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [id]);

  return { venta, cargando, error, recargar };
}