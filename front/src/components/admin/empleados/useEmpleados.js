import { useEffect, useState } from 'react';
import * as usuariosService from '../../../services/usuarios.service.js';

export const LIMITE = 10;

export function useEmpleados() {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [opciones, setOpciones] = useState({ roles: [], sucursales: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await usuariosService.listar({ buscar, pagina, limite: LIMITE });
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
  }, [buscar, pagina, version]);

  useEffect(() => {
    usuariosService.opciones().then(setOpciones).catch((e) => setError(e.message));
  }, []);

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
    opciones,
    crear: async (d) => {
      await usuariosService.crear(d);
      recargar();
    },
    actualizar: async (id, d) => {
      await usuariosService.actualizar(id, d);
      recargar();
    },
  };
}