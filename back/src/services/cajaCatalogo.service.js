import { pool } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import * as turnos from './turnos.service.js';
import * as repo from '../repositories/cajaCatalogo.repository.js';
import { preciosIncluyenIva } from '../repositories/ventas.repository.js';
import { productoCaja } from '../serializers/cajaCatalogo.serializer.js';

// La sucursal y la zona horaria salen del turno abierto del cajero, nunca de lo que mande la pantalla
export async function contextoDelTurno(actor) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
  const estado = await turnos.estadoActual(actor);
  if (estado.estado !== 'turno_abierto') throw new ErrorHttp(409, 'Abre tu turno para vender');
  if (estado.turnoVencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
  return { sucursalId: estado.caja.sucursalId, zona: estado.caja.zonaHoraria };
}

const sucursalDelTurno = async (actor) => (await contextoDelTurno(actor)).sucursalId;

export async function catalogo(actor, consulta) {
  const sucursalId = await sucursalDelTurno(actor);
  const [{ filas, total }, incluyeIva] = await Promise.all([
    repo.listarProductos(pool, actor.empresaId, sucursalId, consulta),
    preciosIncluyenIva(pool, actor.empresaId),
  ]);
  return {
    datos: filas.map(productoCaja),
    total,
    pagina: consulta.pagina,
    limite: consulta.limite,
    preciosIncluyenIva: incluyeIva,
  };
}

export async function escanear(actor, codigo) {
  const sucursalId = await sucursalDelTurno(actor);
  const fila = await repo.buscarPorCodigo(pool, actor.empresaId, sucursalId, codigo);
  if (!fila) throw new ErrorHttp(404, 'No encontramos ese producto en esta sucursal');
  return productoCaja(fila);
}