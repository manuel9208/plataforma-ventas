import { useEffect, useState } from 'react';
import * as svc from '../../services/caja.service.js';

const POR_DEFECTO = { anchoPapel: 80, corteAutomatico: true, abrirCajon: true, imprimirArea: true };

// Cómo imprime la caja del empleado (viene de Cajas → Impresión)
export function useImpresion() {
  const [impresion, setImpresion] = useState(POR_DEFECTO);

  useEffect(() => {
    let vivo = true;
    svc
      .configuracion()
      .then((c) => vivo && c.impresion && setImpresion(c.impresion))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return impresion;
}