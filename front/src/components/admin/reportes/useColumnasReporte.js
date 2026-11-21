import { useState } from 'react';
import { COLUMNAS_POR_DEFECTO, COLUMNAS_REPORTE } from '@plataforma/calculos';

const CLAVE = 'reporte_ventas_columnas';
const VALIDAS = new Set(COLUMNAS_REPORTE.map((c) => c.id));
// Sin servicios no tienen sentido
const SOLO_LIMPIEZA = ['entrega', 'financiamiento'];

function leer() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    const ids = Array.isArray(guardadas) ? guardadas.filter((id) => VALIDAS.has(id)) : [];
    return ids.length ? ids : COLUMNAS_POR_DEFECTO;
  } catch {
    return COLUMNAS_POR_DEFECTO;
  }
}

// Qué columnas ve cada persona: se guardan en este navegador. La lista completa vive en shared/calculos/reporteVentas.js.
export function useColumnasReporte(esLimpieza) {
  const [ids, setIds] = useState(leer);

  const guardar = (nuevas) => {
    setIds(nuevas);
    localStorage.setItem(CLAVE, JSON.stringify(nuevas));
  };

  const disponibles = COLUMNAS_REPORTE.filter((c) => esLimpieza || !SOLO_LIMPIEZA.includes(c.id));
  const elegidas = disponibles.filter((c) => ids.includes(c.id));

  return {
    disponibles,
    ids,
    // Siempre en el orden de siempre; si no queda ninguna, se usan las de por defecto
    columnas: elegidas.length ? elegidas : disponibles.filter((c) => c.defecto),
    alternar: (id) => {
      if (ids.includes(id)) {
        if (elegidas.length > 1) guardar(ids.filter((x) => x !== id));
      } else {
        guardar([...ids, id]);
      }
    },
    restablecer: () => guardar(COLUMNAS_POR_DEFECTO),
  };
}