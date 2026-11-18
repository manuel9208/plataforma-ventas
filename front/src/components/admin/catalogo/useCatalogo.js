import { useEffect, useState } from 'react';
import * as svc from '../../../services/catalogo.service.js';

export const LIMITE = 10;

export function useCatalogo(entidad) {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.listar(entidad, { buscar, pagina, limite: LIMITE });
          if (!vivo) return;
          setDatos(r.datos);
          setTotal(r.total);
          setError('');
        } catch (e) {
          if (vivo) setError(e.message);
        } finally {
          if (vivo) setCargando(false);
        }
      },
      buscar ? 300 : 0
    );
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [entidad, buscar, pagina, version]);

  const recargar = () => setVersion((n) => n + 1);

  return {
    datos,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / LIMITE)),
    setPagina,
    buscar,
    setBuscar: (t) => {
      setBuscar(t);
      setPagina(1);
    },
    cargando,
    error,
    crear: async (d) => {
      await svc.crear(entidad, d);
      recargar();
    },
    actualizar: async (id, d) => {
      await svc.actualizar(entidad, id, d);
      recargar();
    },
  };
}