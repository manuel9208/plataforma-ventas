import { useEffect, useMemo, useState } from 'react';
import { moverPeriodo, rangoDePeriodo, validarRango } from '@plataforma/calculos';
import { hoyISO } from '../../../utils/formato.js';
import * as svc from '../../../services/reportes.service.js';

export const LIMITE = 25;

const INICIAL = {
  tipo: 'dia',
  base: null,
  personalizado: { desde: '', hasta: '' },
  sucursales: null, // null = todas las que tengo asignadas
  empleadoId: '',
  estado: 'todas',
  giro: 'todo',
  orden: 'fecha',
  direccion: 'desc',
  pagina: 1,
  ordenConsumo: 'cantidad',
  hastaHoy: true,
};

// Filtros, periodo y datos del reporte de ventas. Las fechas y los periodos salen de shared/calculos/periodos.js.
export function useReporteVentas() {
  const [opciones, setOpciones] = useState(null);
  const [errorOpciones, setErrorOpciones] = useState('');
  const [f, setF] = useState(INICIAL);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    svc
      .opciones()
      .then((o) => {
        if (!vivo) return;
        setOpciones(o);
        setF((x) => ({ ...x, base: o.hoy ?? hoyISO() }));
      })
      .catch((e) => vivo && setErrorOpciones(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const rango = useMemo(() => {
    if (!f.base) return null;
    try {
      return rangoDePeriodo(f.tipo, f.base, f.tipo === 'rango' ? f.personalizado : null);
    } catch {
      return null;
    }
  }, [f.tipo, f.base, f.personalizado]);

  const validez = rango ? validarRango(rango.desde, rango.hasta) : { ok: false, error: '' };

  // Mismos filtros que la tabla, sin orden ni páginas
  const consultaAnalisis = useMemo(() => {
    if (!rango || !validez.ok) return null;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      sucursales: f.sucursales?.length ? f.sucursales.join(',') : undefined,
      empleadoId: f.empleadoId || undefined,
      estado: f.estado,
      giro: f.giro,
    };
  }, [rango, validez.ok, f.sucursales, f.empleadoId, f.estado, f.giro]);

  // Lo mismo que ve la pantalla, para el PDF y el Excel (sin páginas; las columnas las agrega el botón)
  const consultaExportar = useMemo(() => {
    if (!rango || !validez.ok) return null;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      sucursales: f.sucursales?.length ? f.sucursales.join(',') : undefined,
      empleadoId: f.empleadoId || undefined,
      estado: f.estado,
      giro: f.giro,
      orden: f.orden,
      direccion: f.direccion,
      periodo: f.tipo,
      hastaHoy: f.hastaHoy ? 'true' : 'false',
      ordenConsumo: f.ordenConsumo,
    };
  }, [rango, validez.ok, f.sucursales, f.empleadoId, f.estado, f.giro, f.orden, f.direccion, f.tipo, f.hastaHoy, f.ordenConsumo]);

  const consulta = useMemo(() => {
    if (!rango || !validez.ok) return null;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      sucursales: f.sucursales?.length ? f.sucursales.join(',') : undefined,
      empleadoId: f.empleadoId || undefined,
      estado: f.estado,
      giro: f.giro,
      orden: f.orden,
      direccion: f.direccion,
      limite: LIMITE,
      pagina: f.pagina,
    };
  }, [rango, validez.ok, f.sucursales, f.empleadoId, f.estado, f.giro, f.orden, f.direccion, f.pagina]);

  const consultaEstadisticas = useMemo(() => {
    if (!rango || !validez.ok) return null;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      sucursales: f.sucursales?.length ? f.sucursales.join(',') : undefined,
      empleadoId: f.empleadoId || undefined,
      estado: f.estado,
      giro: f.giro,
      periodo: f.tipo,
      hastaHoy: f.hastaHoy ? 'true' : 'false',
    };
  }, [rango, validez.ok, f.sucursales, f.empleadoId, f.estado, f.giro, f.tipo, f.hastaHoy]);

  const consultaConsumo = useMemo(() => {
    if (!rango || !validez.ok) return null;
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      sucursales: f.sucursales?.length ? f.sucursales.join(',') : undefined,
      empleadoId: f.empleadoId || undefined,
      estado: f.estado,
      giro: f.giro,
      orden: f.ordenConsumo,
    };
  }, [rango, validez.ok, f.sucursales, f.empleadoId, f.estado, f.giro, f.ordenConsumo]);

  useEffect(() => {
    if (!consulta) return undefined;
    let vivo = true;
    setCargando(true);
    svc
      .ventas(consulta)
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [consulta]);

  // Cualquier cambio de filtro vuelve a la primera página
  const cambiar = (parcial) => setF((x) => ({ ...x, pagina: 1, ...parcial }));

  const cambiarTipo = (tipo) =>
    setF((x) => {
      // Al pasar a "Rango" se empieza con las fechas del periodo que se estaba viendo
      const actual = rango ?? { desde: x.base, hasta: x.base };
      return { ...x, tipo, pagina: 1, personalizado: tipo === 'rango' ? { desde: actual.desde, hasta: actual.hasta } : x.personalizado };
    });

  const alternarSucursal = (id) =>
    setF((x) => {
      const todas = (opciones?.sucursales ?? []).map((s) => s.id);
      // Estando "Todas" encendido, tocar una deja solo esa
      const nuevas = x.sucursales === null ? [id] : x.sucursales.includes(id) ? x.sucursales.filter((s) => s !== id) : [...x.sucursales, id];
      const completo = nuevas.length === 0 || nuevas.length === todas.length;
      return { ...x, pagina: 1, sucursales: completo ? null : nuevas };
    });

  return {
    opciones,
    errorOpciones,
    f,
    rango,
    consultaEstadisticas,
    consultaConsumo,
    consultaAnalisis,
    consultaExportar,
    // Opciones que no mueven la tabla de página
    cambiarOpcion: (parcial) => setF((x) => ({ ...x, ...parcial })),
    validez,
    datos,
    cargando,
    error,
    cambiar,
    cambiarTipo,
    cambiarRango: (parcial) => setF((x) => ({ ...x, pagina: 1, personalizado: { ...x.personalizado, ...parcial } })),
    mover: (pasos) => setF((x) => ({ ...x, pagina: 1, base: moverPeriodo(x.tipo, x.base, pasos) })),
    alternarSucursal,
    verTodasLasSucursales: () => cambiar({ sucursales: null }),
    ordenar: (orden) =>
      setF((x) => ({ ...x, pagina: 1, orden, direccion: x.orden === orden && x.direccion === 'desc' ? 'asc' : 'desc' })),
    irAPagina: (pagina) => setF((x) => ({ ...x, pagina })),
  };
}