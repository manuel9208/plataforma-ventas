import { useEffect, useState } from 'react';
import * as svc from '../../../services/reportes.service.js';

// Carga lo consumido cada vez que cambian los filtros o el periodo
export function useConsumoVentas(consulta) {
  const [estado, setEstado] = useState({ datos: null, error: '', cargando: false });
  const clave = consulta ? JSON.stringify(consulta) : '';

  useEffect(() => {
    if (!clave) return undefined;
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true }));
    svc
      .consumo(JSON.parse(clave))
      .then((datos) => vivo && setEstado({ datos, error: '', cargando: false }))
      .catch((e) => vivo && setEstado((previo) => ({ ...previo, error: e.message, cargando: false })));
    return () => {
      vivo = false;
    };
  }, [clave]);

  return estado;
}