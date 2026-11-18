export const CAMPOS_ARTICULO = [
  { clave: 'marca', etiqueta: 'Marca' },
  { clave: 'talla', etiqueta: 'Talla o tamaño' },
  { clave: 'color', etiqueta: 'Color' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'textura', etiqueta: 'Textura' },
  { clave: 'descripcion', etiqueta: 'Cómo llega' },
];

export const NIVELES_CAMPO = ['oculto', 'opcional', 'obligatorio'];

export const CAMPOS_ARTICULO_DEFECTO = {
  marca: 'obligatorio',
  talla: 'obligatorio',
  color: 'obligatorio',
  modelo: 'opcional',
  textura: 'opcional',
  descripcion: 'opcional',
};

// La sucursal manda sobre la empresa; si ninguna dice nada, se usa el valor por defecto
export function resolverCamposArticulo(empresa, sucursal) {
  const r = {};
  for (const { clave } of CAMPOS_ARTICULO) {
    const v = sucursal?.[clave] ?? empresa?.[clave] ?? CAMPOS_ARTICULO_DEFECTO[clave];
    r[clave] = NIVELES_CAMPO.includes(v) ? v : CAMPOS_ARTICULO_DEFECTO[clave];
  }
  return r;
}

// Limpia los datos del artículo y revisa los obligatorios. Lo vacío queda en null.
export function validarArticulo(articulo, config = CAMPOS_ARTICULO_DEFECTO) {
  const datos = {};
  for (const { clave, etiqueta } of CAMPOS_ARTICULO) {
    const nivel = config[clave] ?? CAMPOS_ARTICULO_DEFECTO[clave];
    if (nivel === 'oculto') {
      datos[clave] = null;
      continue;
    }
    const v = String(articulo?.[clave] ?? '').trim().replace(/\s+/g, ' ');
    if (!v) {
      if (nivel === 'obligatorio') return { datos: null, error: `Falta ${etiqueta.toLowerCase()}` };
      datos[clave] = null;
      continue;
    }
    const max = clave === 'descripcion' ? 300 : 60;
    if (v.length > max) return { datos: null, error: `${etiqueta} es demasiado largo (máximo ${max})` };
    datos[clave] = v;
  }
  return { datos, error: null };
}