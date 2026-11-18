// SKU de 6 dígitos = 2 del departamento + 4 del consecutivo (0001 a 9999)
export function armarSku(codigoDepartamento, consecutivo) {
  const codigo = String(codigoDepartamento).padStart(2, '0');
  if (!/^\d{2}$/.test(codigo)) throw new Error('Código de departamento inválido');
  if (!Number.isInteger(consecutivo) || consecutivo < 1 || consecutivo > 9999) {
    throw new Error('Consecutivo fuera de rango');
  }
  return codigo + String(consecutivo).padStart(4, '0');
}

export const esSkuValido = (sku) => /^\d{6}$/.test(String(sku));