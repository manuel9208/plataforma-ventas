export const NOMBRES_MES_CUMPLE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Febrero con 29: quien nació el 29 de febrero también tiene cumpleaños
const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const diasMaximosDelMes = (mes) => DIAS_POR_MES[mes - 1] ?? 31;

export function validarCumple(mes, dia) {
  return Number.isInteger(mes) && Number.isInteger(dia) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasMaximosDelMes(mes);
}

// ÚNICA fórmula del "perfil completo": lo que falta para que el cliente pueda ganar puntos
export function estadoPerfil({ correo, cumpleMes, cumpleDia, tienePin }) {
  const falta = [];
  if (!correo) falta.push('correo');
  if (!validarCumple(cumpleMes, cumpleDia)) falta.push('cumpleaños');
  if (!tienePin) falta.push('PIN');
  return { completo: falta.length === 0, falta };
}

// PIN demasiado fácil de adivinar: repetido (0000, 1111…) o en secuencia (1234, 4321…)
export function pinDebil(pin) {
  const p = String(pin ?? '');
  if (!/^\d{4}$/.test(p)) return true;
  if (/^(\d)\1{3}$/.test(p)) return true;
  const d = [...p].map(Number);
  const sube = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const baja = d.every((n, i) => i === 0 || n === d[i - 1] - 1);
  return sube || baja;
}