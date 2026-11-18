const MAX_PIE = 600;

// Reemplaza {empresa}, {sucursal} y {direccion} en el pie del ticket.
// Una línea cuya variable no tenga valor se omite completa, para que no salga "Sucursal: ".
export function resolverPie(texto, datos = {}) {
  if (!texto) return [];
  const lineas = [];
  for (const linea of String(texto).slice(0, MAX_PIE).split('\n')) {
    let falta = false;
    const resuelta = linea.replace(/\{(\w+)\}/g, (_m, clave) => {
      const v = datos[clave];
      if (v === undefined || v === null || String(v).trim() === '') {
        falta = true;
        return '';
      }
      return String(v);
    });
    if (!falta && resuelta.trim()) lineas.push(resuelta.trim());
  }
  return lineas;
}