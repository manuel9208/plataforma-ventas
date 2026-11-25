import { useEffect, useState } from 'react';
import * as svc from '../../services/notas.service.js';

const LIMITE = 15;

// Lista de notas: pestaña, búsqueda (con pausa al escribir) y "Ver más"
export function useNotas() {
  const [pestana, setPestana] = useState('cobrar');
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');
  const [fecha, setFecha] = useState(''); // AAAA-MM-DD o '' (todas)
  const [atrasadas, setAtrasadas] = useState(false);
  const [cotizar, setCotizar] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [conteos, setConteos] = useState({});
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
      .listar({
        pestana,
        buscar: consulta,
        limite: LIMITE,
        pagina,
        ...(fecha ? { fecha } : {}),
        ...(atrasadas ? { atrasadas: 'true' } : {}),
        ...(cotizar ? { cotizar: 'true' } : {}),
      })
      .then((r) => {
        if (!vivo) return;
        setDatos((previas) => (pagina === 1 ? r.datos : [...previas, ...r.datos]));
        setTotal(r.total);
        setConteos(r.conteos);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [pestana, consulta, pagina, version, fecha, atrasadas, cotizar]);

  return {
    pestana,
    cambiarPestana: (p) => {
      setPestana(p);
      setPagina(1);
    },
    buscar,
    setBuscar,
    consulta,
    fecha,
    atrasadas,
    cotizar,
    // Fecha exacta y "Atrasadas" no se combinan: elegir una quita la otra
    ponerFecha: (f) => {
      setFecha(f);
      setAtrasadas(false);
      setPagina(1);
    },
    ponerAtrasadas: (v) => {
      setAtrasadas(v);
      if (v) setFecha('');
      setPagina(1);
    },
    // Se combina con la fecha y con "Atrasadas"
    ponerCotizar: (v) => {
      setCotizar(v);
      setPagina(1);
    },
    datos,
    total,
    conteos,
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