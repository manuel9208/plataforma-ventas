import { useEffect, useState } from 'react';
import * as svc from '../../../services/empresasGlobal.service.js';

const LIMITE = 20;

// Lista de todas las empresas: búsqueda (con pausa al escribir), estado y "Ver más"
export function useEmpresas() {
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');
  const [estado, setEstado] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setConsulta(buscar.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [buscar]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    svc
      .listar({ buscar: consulta, estado, limite: LIMITE, pagina })
      .then((r) => {
        if (!vivo) return;
        setDatos((previas) => (pagina === 1 ? r.datos : [...previas, ...r.datos]));
        setTotal(r.total);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [consulta, estado, pagina, version]);

  return {
    buscar,
    setBuscar,
    consulta,
    estado,
    cambiarEstado: (e) => {
      setEstado(e);
      setPagina(1);
    },
    datos,
    total,
    cargando,
    cargandoMas: cargando && pagina > 1,
    error,
    hayMas: datos.length < total,
    verMas: () => setPagina((p) => p + 1),
    recargar: () => {
      setPagina(1);
      setVersion((v) => v + 1);
    },
  };
}