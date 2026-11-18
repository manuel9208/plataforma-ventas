import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/movimientos.service.js';

const VACIO = {
  zonaHoraria: null,
  movimientos: [],
  totales: { gastos: 0, retiros: 0 },
  retiro: { limite: 0, acumulado: 0, debeRetirar: false, retirar: 0 },
};

// Gastos y retiros del turno, y el aviso de retiro. Solo consulta cuando hay un turno abierto.
export function useMovimientos(activo = true) {
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      setDatos(await svc.listar());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (activo) recargar();
  }, [activo, recargar]);

  return {
    ...datos,
    error,
    recargar,
    crear: async (cuerpo) => {
      const r = await svc.crear(cuerpo);
      await recargar();
      return r;
    },
    anular: async (id, cuerpo) => {
      const r = await svc.anular(id, cuerpo);
      await recargar();
      return r;
    },
  };
}