import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/caja.service.js';

const CADA_MS = 60_000;
const VACIO = { promociones: [], descuentoManualMax: 0, puedeAutorizar: false };

// Promociones vigentes ahora. Se vuelven a pedir cada minuto para notar un happy hour que empieza o termina.
export function usePromocionesCaja() {
  const [datos, setDatos] = useState(VACIO);

  const recargar = useCallback(async () => {
    try {
      setDatos(await svc.promociones());
    } catch {
      // Si falla se queda lo último: el servidor decide los precios al cobrar
    }
  }, []);

  useEffect(() => {
    recargar();
    const t = setInterval(recargar, CADA_MS);
    return () => clearInterval(t);
  }, [recargar]);

  return { ...datos, recargar };
}