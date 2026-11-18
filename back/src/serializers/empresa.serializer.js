export function serializarEmpresaPublica(e) {
  return {
    slug: e.slug,
    nombre: e.nombre,
    tipoNegocio: e.tipo_negocio,
    zonaHoraria: e.zona_horaria,
    moneda: e.moneda,
  };
}