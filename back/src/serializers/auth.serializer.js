export function serializarSesion(usuario, sucursales, empresa, modulos = []) {
  return {
    empresa: {
      slug: empresa.slug,
      nombre: empresa.nombre,
      tipoNegocio: empresa.tipo_negocio,
      zonaHoraria: empresa.zona_horaria,
      moneda: empresa.moneda,
    },
    usuario: {
      id: usuario.id,
      telefono: usuario.telefono,
      nombre: usuario.nombre,
      rol: usuario.rol,
      nivel: usuario.nivel,
      permisos: usuario.permisos,
    },
    sucursales,
    // Solo las claves de los módulos que la empresa tiene encendidos. Nunca precios.
    modulos,
  };
}