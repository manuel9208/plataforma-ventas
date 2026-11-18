// Dígito verificador EAN-13 a partir de los primeros 12 dígitos
export function digitoVerificadorEan13(doce) {
  const d = String(doce);
  if (!/^\d{12}$/.test(d)) throw new Error('Se necesitan 12 dígitos');
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (suma % 10)) % 10;
}

// Código interno EAN-13: prefijo 20 (uso interno) + id de la presentación a 10 dígitos + verificador
export function generarCodigoInterno(presentacionId) {
  const id = Number(presentacionId);
  if (!Number.isInteger(id) || id < 1 || id > 9999999999) throw new Error('Id inválido');
  const doce = '20' + String(id).padStart(10, '0');
  return doce + digitoVerificadorEan13(doce);
}