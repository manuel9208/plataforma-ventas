import { useEffect, useState } from 'react';
import * as svc from '../../../services/cajas.service.js';

export function useCajas() {
  const [cajas, setCajas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([svc.opciones(), svc.listar({})])
      .then(([o, lista]) => {
        if (!vivo) return;
        setSucursales(o.sucursales);
        setCajas(lista);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [version]);

  const recargar = () => setVersion((n) => n + 1);

  return {
    cajas,
    sucursales,
    cargando,
    error,
    recargar,
    crear: async (d) => {
      await svc.crear(d);
      recargar();
    },
    actualizar: async (id, d) => {
      await svc.actualizar(id, d);
      recargar();
    },
  };
}