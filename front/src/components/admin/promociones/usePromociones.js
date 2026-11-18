import { useCallback, useEffect, useRef, useState } from 'react';
import * as svc from '../../../services/promociones.service.js';

const POR_PAGINA = 20;

export function usePromociones() {
  const [buscar, setBuscar] = useState('');
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [opciones, setOpciones] = useState(null);
  const ultima = useRef(0);

  const cargar = useCallback(async (texto, pag) => {
    const n = ++ultima.current;
    setCargando(true);
    try {
      const r = await svc.listar({ buscar: texto || undefined, pagina: pag, limite: POR_PAGINA });
      if (n !== ultima.current) return;
      setLista((previa) => (pag === 1 ? r.datos : [...previa, ...r.datos]));
      setTotal(r.total);
      setPagina(pag);
      setError('');
    } catch (e) {
      if (n === ultima.current) setError(e.message);
    } finally {
      if (n === ultima.current) setCargando(false);
    }
  }, []);

  // Al escribir en el buscador se espera un momento para no consultar en cada letra
  useEffect(() => {
    const espera = setTimeout(() => cargar(buscar.trim(), 1), buscar ? 300 : 0);
    return () => clearTimeout(espera);
  }, [buscar, cargar]);

  useEffect(() => {
    svc.opciones().then(setOpciones).catch((e) => setError(e.message));
  }, []);

  const recargar = () => cargar(buscar.trim(), 1);

  return {
    buscar,
    setBuscar,
    lista,
    total,
    cargando,
    error,
    opciones,
    hayMas: lista.length < total,
    verMas: () => cargar(buscar.trim(), pagina + 1),
    obtener: svc.obtener,
    guardar: async (id, cuerpo) => {
      if (id) await svc.actualizar(id, cuerpo);
      else await svc.crear(cuerpo);
      await recargar();
    },
    // El servidor responde con la promoción ya actualizada (incluido su estado)
    encender: async (id, encendida) => {
      const r = await svc.encender(id, encendida);
      setLista((l) => l.map((x) => (x.id === id ? { ...x, ...r } : x)));
    },
    darDeBaja: async (id, motivo) => {
      await svc.baja(id, motivo);
      await recargar();
    },
  };
}