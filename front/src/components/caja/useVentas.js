import { useEffect, useState } from 'react';
import * as svc from '../../services/ventasMostrador.service.js';

const LIMITE = 15;

// Lista de ventas de mostrador: búsqueda (con pausa al escribir), fechas y "Ver más"
export function useVentas() {
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [verTodas, setVerTodas] = useState(false);
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
      .listar({ buscar: consulta, desde, hasta, limite: LIMITE, pagina })
      .then((r) => {
        if (!vivo) return;
        setDatos((previas) => (pagina === 1 ? r.datos : [...previas, ...r.datos]));
        setTotal(r.total);
        setVerTodas(r.verTodas);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [consulta, desde, hasta, pagina, version]);

  return {
    buscar,
    setBuscar,
    consulta,
    desde,
    hasta,
    cambiarDesde: (v) => {
      setDesde(v);
      setPagina(1);
    },
    cambiarHasta: (v) => {
      setHasta(v);
      setPagina(1);
    },
    datos,
    total,
    verTodas,
    cargando,
    refrescando: cargando && datos.length > 0 && pagina === 1,
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