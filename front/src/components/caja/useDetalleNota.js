import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/notas.service.js';

export function useDetalleNota(id) {
  const [nota, setNota] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    svc
      .obtener(id)
      .then((n) => {
        if (!vivo) return;
        setNota(n);
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
      setNota(await svc.obtener(id));
      setError('');
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [id]);

  // El servidor responde con la nota ya actualizada
  const cambiarEstado = async (datos) => {
    const n = await svc.cambiarEstado(id, datos);
    setNota(n);
    return n;
  };

  return { nota, cargando, error, recargar, cambiarEstado };
}