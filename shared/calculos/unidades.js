// ÚNICA fuente de unidades. Para agregar una unidad nueva basta una línea aquí.
export const UNIDADES = [
  { clave: 'pieza', nombre: 'Pieza', abreviatura: 'pza' },
  { clave: 'ml', nombre: 'Mililitro', abreviatura: 'ml' },
  { clave: 'lt', nombre: 'Litro', abreviatura: 'lt' },
  { clave: 'g', nombre: 'Gramo', abreviatura: 'g' },
  { clave: 'kg', nombre: 'Kilogramo', abreviatura: 'kg' },
  { clave: 'oz', nombre: 'Onza', abreviatura: 'oz' },
  { clave: 'caja', nombre: 'Caja', abreviatura: 'caja' },
  { clave: 'paquete', nombre: 'Paquete', abreviatura: 'paq' },
  { clave: 'carton', nombre: 'Cartón', abreviatura: 'cartón' },
];

export const CLAVES_UNIDAD = UNIDADES.map((u) => u.clave);

export const esUnidadValida = (clave) => CLAVES_UNIDAD.includes(clave);

export const nombreUnidad = (clave) => UNIDADES.find((u) => u.clave === clave)?.nombre ?? clave;

// Convierte una cantidad de una presentación a la unidad base del producto.
// Ejemplo: 3 cartones de 12 piezas -> aUnidadBase(3, 12) = 36
export function aUnidadBase(cantidad, factor) {
  const c = Number(cantidad);
  const f = Number(factor);
  if (!Number.isFinite(c) || !Number.isFinite(f) || f <= 0) throw new Error('Cantidad o factor inválido');
  return Number((c * f).toFixed(4));
}