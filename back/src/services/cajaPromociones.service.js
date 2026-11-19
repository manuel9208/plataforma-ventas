import { promocionVigente } from '@plataforma/calculos';
import { pool } from '../config/db.js';
import { moduloActivo } from '../utils/modulos.js';
import { tienePermiso } from '../utils/permisos.js';
import * as notasRepo from '../repositories/notas.repository.js';
import * as promoRepo from '../repositories/promociones.repository.js';
import { contextoDelTurno } from './cajaCatalogo.service.js';

// Promociones vigentes AHORA en la sucursal del turno, para que la Caja muestre el mismo precio que cobrará el servidor
export async function vigentes(actor) {
  const { sucursalId, zona } = await contextoDelTurno(actor);
  if (!(await moduloActivo(actor.empresaId, 'promociones'))) return { promociones: [], descuentoManualMax: 0, puedeAutorizar: false };

  const [todas, config] = await Promise.all([
    promoRepo.cargarParaVenta(pool, actor.empresaId, sucursalId),
    notasRepo.cargarConfig(pool, actor.empresaId, sucursalId),
  ]);
  return {
    promociones: todas
      .filter((p) => promocionVigente(p, { zona }))
      .map(({ id, nombre, tipo, modo, valor, precioCombo, lleva, paga, aplicaA, objetivos, items }) => ({
        id,
        nombre,
        tipo,
        modo,
        valor,
        precioCombo,
        lleva,
        paga,
        aplicaA,
        objetivos,
        items,
      })),
    descuentoManualMax: config.descuentoManualMax,
    puedeAutorizar: tienePermiso(actor.permisos, 'caja.descuentos'),
  };
}