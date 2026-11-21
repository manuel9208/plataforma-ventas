import { useEffect, useState } from 'react';

// Carga una lista de Mi cuenta. "cargar" debe ser una función fija (la del servicio).
export function useLista(cargar) {
  const [estado, setEstado] = useState({ cargando: true, datos: [], error: '' });

  useEffect(() => {
    let vivo = true;
    cargar()
      .then((r) => vivo && setEstado({ cargando: false, datos: r.datos, error: '' }))
      .catch((e) => vivo && setEstado({ cargando: false, datos: [], error: e.message }));
    return () => {
      vivo = false;
    };
  }, [cargar]);

  return estado;
}