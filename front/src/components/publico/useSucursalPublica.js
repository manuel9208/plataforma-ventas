import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../services/publico.service.js';
import { sucursalMasCercana } from '@plataforma/calculos';

const CLAVE = 'sucursal_publica';

export function useSucursalPublica() {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ubicando, setUbicando] = useState(false);
  const [aviso, setAviso] = useState('');

  const elegir = useCallback((id) => {
    setSucursalId(id);
    localStorage.setItem(CLAVE, String(id)); // solo se recuerda la sucursal, nunca la ubicación
  }, []);

  // La distancia se calcula aquí, en el navegador. La ubicación no se envía ni se guarda.
  const ubicar = useCallback(
    (lista, silencioso = false) => {
      const conCoordenadas = lista.filter((s) => s.lat !== null && s.lon !== null);
      if (!navigator.geolocation || conCoordenadas.length === 0) {
        if (!silencioso) setAviso('No pudimos calcular tu ubicación. Elige tu sucursal de la lista.');
        return;
      }
      setUbicando(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const cercana = sucursalMasCercana({ lat: pos.coords.latitude, lon: pos.coords.longitude }, conCoordenadas);
          if (cercana) {
            elegir(cercana.id);
            setAviso('');
          }
          setUbicando(false);
        },
        () => {
          setUbicando(false);
          if (!silencioso) setAviso('No diste permiso de ubicación. Elige tu sucursal de la lista.');
        },
        { timeout: 8000, maximumAge: 600000 }
      );
    },
    [elegir]
  );

  useEffect(() => {
    let vivo = true;
    svc
      .sucursales()
      .then((lista) => {
        if (!vivo) return;
        setSucursales(lista);
        const guardada = Number(localStorage.getItem(CLAVE));
        if (lista.some((s) => s.id === guardada)) {
          setSucursalId(guardada);
        } else {
          setSucursalId(lista[0]?.id ?? null); // respaldo mientras se calcula la ubicación
          if (lista.length > 1) ubicar(lista, true);
        }
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [ubicar]);

  return {
    sucursales,
    sucursalId,
    elegir,
    usarMiUbicacion: () => ubicar(sucursales),
    ubicando,
    aviso,
    cargando,
    error,
  };
}