import { useEffect, useState } from 'react';
import * as svc from '../../../services/cortes.service.js';

const LIMITE = 20;
const FILTROS = { sucursalId: '', desde: '', hasta: '', resultado: '' };

// Lista de cortes con filtros y "Ver más"
export function useCortes() {
  const [filtros, setFiltros] = useState(FILTROS);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    svc
      .listar({ ...filtros, limite: LIMITE, pagina })
      .then((r) => {
        if (!vivo) return;
        setDatos((previas) => (pagina === 1 ? r.datos : [...previas, ...r.datos]));
        setTotal(r.total);
        setResumen(r.resumen);
        setSucursales(r.sucursales);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [filtros, pagina]);

  return {
    filtros,
    cambiarFiltros: (parcial) => {
      setFiltros((f) => ({ ...f, ...parcial }));
      setPagina(1);
    },
    limpiarFiltros: () => {
      setFiltros(FILTROS);
      setPagina(1);
    },
    datos,
    total,
    resumen,
    sucursales,
    cargando,
    cargandoMas: cargando && pagina > 1,
    error,
    hayMas: datos.length < total,
    verMas: () => setPagina((p) => p + 1),
  };
}