import { useEffect, useState } from 'react';
import * as svc from '../../services/publico.service.js';

const LIMITE = 24;

export function useCatalogoPublico({ sucursalId, tipo }) {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState({ clave: '', pagina: 1 });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Cada cambio de sucursal, tipo o búsqueda vuelve a la primera página
  const clave = `${sucursalId}|${tipo}|${buscar}`;
  const pagina = estado.clave === clave ? estado.pagina : 1;

  useEffect(() => {
    if (!sucursalId) return;
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.catalogo({ sucursalId, tipo, buscar, pagina, limite: LIMITE });
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
  }, [clave, pagina]);

  return {
    datos,
    total,
    cargando,
    error,
    buscar,
    setBuscar,
    hayMas: datos.length < total,
    verMas: () => setEstado({ clave, pagina: pagina + 1 }),
  };
}