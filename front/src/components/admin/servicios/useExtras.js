import { useEffect, useState } from 'react';
import * as svc from '../../../services/extras.service.js';

export const LIMITE = 10;

export function useExtras() {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activos'); // activos | inactivos | todos
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [opciones, setOpciones] = useState({ tasasIva: [], sucursales: [] });
  const [opcionesListas, setOpcionesListas] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.listar({
            buscar,
            pagina,
            limite: LIMITE,
            activo: estado === 'todos' ? undefined : estado === 'activos',
          });
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
  }, [buscar, pagina, estado, version]);

  useEffect(() => {
    svc
      .opciones()
      .then((o) => {
        setOpciones(o);
        setOpcionesListas(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  const recargar = () => setVersion((n) => n + 1);
  const reiniciarPagina = (fn) => (v) => {
    fn(v);
    setPagina(1);
  };

  return {
    datos,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / LIMITE)),
    setPagina,
    buscar,
    setBuscar: reiniciarPagina(setBuscar),
    estado,
    setEstado: reiniciarPagina(setEstado),
    cargando,
    error,
    opciones,
    opcionesListas,
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