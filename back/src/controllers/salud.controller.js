import { revisarSalud } from '../services/salud.service.js';

export async function obtenerSalud(_req, res) {
  try {
    res.json(await revisarSalud());
  } catch (err) {
    console.error('[salud]', err.message);
    res.status(503).json({ estado: 'error' });
  }
}