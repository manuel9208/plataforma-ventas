import { useEffect, useState } from 'react';
import * as svc from '../../services/caja.service.js';

const LIMITE = 24;

export function useCatalogoServicios(activo) {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState({ clave: '', pagina: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const pagina = estado.clave === buscar ? estado.pagina : 1;

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.servicios({ buscar: buscar.trim() || undefined, pagina, limite: LIMITE });
          if (!vivo) return;
          setDatos((previos) => (pagina === 1 ? r.datos : [...previos, ...r.datos]));
          setTotal(r.total);
          setError('');
        } catch (e) {
          if (vivo) setError(e.message);
        } finally {
          if (vivo) setCargando(false);
        }
      },
      buscar && pagina === 1 ? 300 : 0
    );
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [activo, buscar, pagina]);

  return {
    datos,
    total,
    cargando,
    error,
    buscar,
    setBuscar,
    hayMas: datos.length < total,
    verMas: () => setEstado({ clave: buscar, pagina: pagina + 1 }),
  };
}