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

export const MAX_COMENTARIO = 300;

export function limpiarComentario(texto) {
  const v = String(texto ?? '').trim().replace(/\s+/g, ' ');
  return v ? v.slice(0, MAX_COMENTARIO) : null;
}

// Una nota se captura por artículo (cada artículo con uno o varios servicios). Aquí se aplana a la lista de servicios, en orden.
// Servidor y Caja usan ESTA función: las promociones y el descuento manual cuentan los servicios por posición (s0, s1…).
// articulos: [{ datos, comentario?, servicios: [{ servicioId, tipoArticuloId, extraIds, fechaPrometida? }] }]
export function aplanarArticulos(articulos = []) {
  const servicios = [];
  const grupos = [];
  articulos.forEach((a, indice) => {
    const posiciones = [];
    for (const s of a.servicios ?? []) {
      posiciones.push(servicios.length);
      servicios.push({ ...s, articulo: a.datos ?? {}, indiceArticulo: indice });
    }
    grupos.push({ indice, comentario: limpiarComentario(a.comentario), posiciones });
  });
  return { servicios, grupos };
}

// Identifica "el mismo artículo" de un cliente: marca + talla + color + modelo + textura,
// sin importar mayúsculas, acentos ni espacios de más. La descripción NO entra en la clave.
const CAMPOS_CLAVE = ['marca', 'talla', 'color', 'modelo', 'textura'];
const normalizarClave = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Devuelve '' si no hay ningún dato (ese artículo no se guarda)
export function claveArticulo(datos = {}) {
  const partes = CAMPOS_CLAVE.map((c) => normalizarClave(datos?.[c]));
  return partes.some(Boolean) ? partes.join('|') : '';
}