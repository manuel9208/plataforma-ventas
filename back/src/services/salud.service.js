import { verificarConexion } from '../repositories/salud.repository.js';

export async function revisarSalud() {
  await verificarConexion();
  return { estado: 'ok' };
}