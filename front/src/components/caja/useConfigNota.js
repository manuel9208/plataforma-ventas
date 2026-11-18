import { useEffect, useState } from 'react';
import * as svc from '../../services/caja.service.js';

// Abono, datos del artículo, PIN y "hoy" en la zona de la sucursal
export function useConfigNota() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    svc
      .configuracion()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  return { config, error };
}