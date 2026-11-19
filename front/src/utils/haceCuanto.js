const DIA = 86400000;

// "hoy", "ayer", "hace 15 días", "hace 2 meses" (tiempo transcurrido: no depende de la zona horaria)
export function haceCuanto(fechaISO, ahora = Date.now()) {
  const dias = Math.floor((ahora - new Date(fechaISO).getTime()) / DIA);
  if (!Number.isFinite(dias) || dias < 0) return '';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
  const anios = Math.floor(dias / 365);
  return anios === 1 ? 'hace 1 año' : `hace ${anios} años`;
}