import { useEffect, useState } from 'react';
import * as svc from '../../services/caja.service.js';

const LIMITE = 24;

export function useCatalogoCaja() {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState({ clave: '', pagina: 1 });
  const [incluyeIva, setIncluyeIva] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Cada búsqueda nueva vuelve a la primera página
  const pagina = estado.clave === buscar ? estado.pagina : 1;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.catalogo({ buscar: buscar.trim() || undefined, pagina, limite: LIMITE });
          if (!vivo) return;
          setDatos((previos) => (pagina === 1 ? r.datos : [...previos, ...r.datos]));
          setTotal(r.total);
          setIncluyeIva(r.preciosIncluyenIva);
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
  }, [buscar, pagina]);

  return {
    datos,
    total,
    cargando,
    error,
    buscar,
    setBuscar,
    incluyeIva,
    hayMas: datos.length < total,
    verMas: () => setEstado({ clave: buscar, pagina: pagina + 1 }),
  };
}