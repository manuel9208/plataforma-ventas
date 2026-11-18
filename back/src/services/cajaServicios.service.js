import { hoyEnZona } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { contextoDelTurno } from './cajaCatalogo.service.js';
import * as repo from '../repositories/notas.repository.js';
import { servicioCaja } from '../serializers/cajaServicios.serializer.js';

// Lo que la pantalla necesita para armar una nota: abono, datos del artículo, PIN y "hoy" en la zona de la sucursal
export async function configuracion(actor) {
  const { sucursalId, zona } = await contextoDelTurno(actor);
  const c = await repo.cargarConfig(pool, actor.empresaId, sucursalId);
  return { ...c, hoy: hoyEnZona(zona), zonaHoraria: zona };
}

export async function servicios(actor, empresa, consulta) {
  const { sucursalId } = await contextoDelTurno(actor);
  const base = { pagina: consulta.pagina, limite: consulta.limite };
  // Los servicios solo existen en el giro de limpieza
  if (empresa.tipo_negocio !== 'limpieza') return { datos: [], total: 0, ...base };
  const { filas, total } = await repo.listarServicios(pool, actor.empresaId, sucursalId, consulta);
  return { datos: filas.map(servicioCaja), total, ...base };
}

export async function sugerencias(actor, { campo, buscar }) {
  await contextoDelTurno(actor);
  return repo.sugerencias(pool, actor.empresaId, campo, buscar);
}