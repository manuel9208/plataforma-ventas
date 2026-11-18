import { GRUPOS_CONFIG, TIPOS_TEXTO, VARIABLES_PIE, ajustesVisibles } from '@plataforma/calculos';

const num = (v) => (v === null || v === undefined ? null : Number(v));

export const sucursalVista = (s, zonaEmpresa) => ({
  id: s.id,
  nombre: s.nombre,
  telefono: s.telefono,
  direccion: s.direccion,
  referencias: s.referencias,
  mapaUrl: s.mapa_url,
  lat: num(s.lat),
  lon: num(s.lon),
  zonaHoraria: s.zona_horaria ?? zonaEmpresa,
  zonaPropia: Boolean(s.zona_horaria),
  esPrincipal: s.es_principal,
});

// Todo lo que la pantalla necesita, ya armado según el giro y el alcance (empresa o sucursal)
export function vistaConfiguracion({ empresa, sucursales, alcance, puedeEmpresa, cfg, sucursal }) {
  const enSucursal = Boolean(alcance);
  const visibles = ajustesVisibles(empresa.tipo_negocio).filter((a) => !enSucursal || a.nivel === 'ambos');

  const grupos = GRUPOS_CONFIG.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    descripcion: g.descripcion,
    ancho: Boolean(g.ancho),
    ajustes: visibles
      .filter((a) => a.grupo === g.id)
      .map((a) => {
        const vacio = TIPOS_TEXTO.includes(a.tipo) ? '' : null;
        const deEmpresa = cfg.empresa[a.clave] ?? a.defecto ?? vacio;
        const propio = enSucursal ? cfg.sucursal[a.clave] : deEmpresa;
        return {
          clave: a.clave,
          etiqueta: a.etiqueta,
          descripcion: a.descripcion,
          tipo: a.tipo,
          opciones: a.opciones ?? null,
          min: a.min ?? null,
          max: a.max ?? null,
          valor: propio ?? deEmpresa,
          // En una sucursal: tiene valor propio o usa el de la empresa
          propio: enSucursal ? propio !== null : true,
          valorEmpresa: deEmpresa,
        };
      }),
  })).filter((g) => g.ajustes.length > 0);

  return {
    empresa: { nombre: empresa.nombre, tipoNegocio: empresa.tipo_negocio, zonaHoraria: empresa.zona_horaria },
    sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    alcance: alcance ?? null,
    puedeEditar: enSucursal ? true : puedeEmpresa,
    puedeElegirEmpresa: puedeEmpresa,
    puedeCambiarPrincipal: puedeEmpresa,
    sucursal: sucursal ? sucursalVista(sucursal, empresa.zona_horaria) : null,
    variablesPie: VARIABLES_PIE,
    grupos,
  };
}