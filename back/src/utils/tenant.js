// Toda consulta de repositories debe llamar a esto primero
export function exigirEmpresa(empresaId) {
  if (!Number.isInteger(empresaId) || empresaId < 1) {
    throw new Error('Consulta sin empresaId: rechazada');
  }
}