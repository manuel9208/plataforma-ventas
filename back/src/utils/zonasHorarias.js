// ¿Es una zona horaria que el sistema reconoce? (por ejemplo America/Mazatlan)
export function zonaValida(zona) {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}