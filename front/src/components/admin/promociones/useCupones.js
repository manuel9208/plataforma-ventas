import { useCallback, useEffect, useRef, useState } from 'react';
import * as svc from '../../../services/cupones.service.js';
import { textoError } from '../../../utils/textoError.js';

const LIMITE = 20;

export function useCupones() {
  const [buscar, setBuscar] = useState('');
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [opciones, setOpciones] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const consulta = useRef(0);

  const cargar = useCallback(async (pag, texto) => {
    const n = ++consulta.current;
    setCargando(true);
    setError('');
    try {
      const r = await svc.listar({ buscar: texto || undefined, limite: LIMITE, pagina: pag });
      if (n !== consulta.current) return;
      setLista((a) => (pag === 1 ? r.datos : [...a, ...r.datos]));
      setTotal(r.total);
      setPagina(pag);
    } catch (e) {
      if (n === consulta.current) setError(textoError(e));
    } finally {
      if (n === consulta.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(1, buscar.trim()), buscar ? 300 : 0);
    return () => clearTimeout(t);
  }, [buscar, recarga, cargar]);

  useEffect(() => {
    svc
      .opciones()
      .then(setOpciones)
      .catch((e) => setError(textoError(e)));
  }, []);

  const reemplazar = (cupon) => setLista((a) => a.map((x) => (x.id === cupon.id ? cupon : x)));

  return {
    buscar,
    setBuscar,
    lista,
    cargando,
    error,
    opciones,
    hayMas: lista.length < total,
    verMas: () => cargar(pagina + 1, buscar.trim()),
    // id null = cupón nuevo
    guardar: async (id, datos) => {
      const r = id ? await svc.actualizar(id, datos) : await svc.crear(datos);
      setRecarga((n) => n + 1);
      return r;
    },
    encender: async (id, valor) => reemplazar(await svc.encender(id, valor)),
    darDeBaja: async (id, motivo) => {
      await svc.baja(id, motivo);
      setRecarga((n) => n + 1);
    },
  };
}