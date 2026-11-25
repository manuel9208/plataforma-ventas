import { aCentavos, aMonto, aplanarArticulos, calcularLineaVenta, hoyEnZona, totalesVenta } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { tienePermiso } from '../utils/permisos.js';
import { aplicarPromocionesVenta } from './promocionesVenta.service.js';
import { armarProductos, armarServicios, sumarImporte } from './ventas.service.js';
import { guardarArticulosDeCliente } from './clienteArticulos.service.js';
import { cargarDetalle } from './notas.service.js';
import * as repo from '../repositories/adiciones.repository.js';
import * as ventasRepo from '../repositories/ventas.repository.js';
import * as notasRepo from '../repositories/notas.repository.js';
import * as listaRepo from '../repositories/notasLista.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';

// Mientras quede algún servicio sin entregar (ni cancelar), la nota admite agregados
const SIN_ENTREGAR = ['recibido', 'en_proceso', 'listo'];

async function respuesta(db, actor, ventaId, adicion, repetida) {
  const nota = await cargarDetalle(db, actor, ventaId);
  if (!nota) throw new ErrorHttp(404, 'Nota no encontrada');
  return {
    ...nota,
    puedeGestionar: tienePermiso(actor.permisos, 'notas.gestionar'),
    puedeEditar: tienePermiso(actor.permisos, 'notas.editar'),
    adicion: { id: adicion.id, total: Number(adicion.total), repetida },
  };
}

// Agrega productos y artículos con servicios a una nota abierta. El servidor decide precios, promociones, IVA y total.
// No pide abono: lo agregado se suma al saldo y se cobra después con "Cobrar saldo".
export async function agregar(actor, ventaId, datos, ip) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
  const e = actor.empresaId;

  // Reintento de una adición ya guardada: se devuelve la nota tal cual, sin agregar de nuevo
  const previo = await repo.buscarAdicion(pool, e, datos.id);
  if (previo) {
    if (previo.venta_id !== ventaId || previo.usuario_id !== actor.id) throw new ErrorHttp(409, 'Esa operación ya existe');
    return respuesta(pool, actor, ventaId, previo, true);
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para agregar a la nota');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  // Los servicios van por posición (s0, s1…), igual que en una venta nueva
  const { servicios: pedidos, grupos } = aplanarArticulos(datos.articulos);

  try {
    return await conTransaccion(async (db) => {
      const t = await ventasRepo.bloquearTurno(db, e, turno.id);
      if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
      if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
      if (t.usuario_id !== actor.id) throw new ErrorHttp(403, 'Ese turno no es tuyo');
      const sucursalId = t.sucursal_id;

      // Solo notas de la misma sucursal del turno
      const v = await repo.bloquearNota(db, e, ventaId, [sucursalId]);
      if (!v || !v.tiene_servicios) throw new ErrorHttp(404, 'Nota no encontrada en esta sucursal');

      const estados = await listaRepo.cargarPartidasEstado(db, e, ventaId);
      if (!estados.some((f) => SIN_ENTREGAR.includes(f.estado_trabajo))) {
        throw new ErrorHttp(409, 'Esta nota ya está entregada o cancelada. Ya no se le puede agregar nada.');
      }

      const config = await notasRepo.cargarConfig(db, e, sucursalId);
      if (datos.lineas.length && !config.vendeProductos) throw new ErrorHttp(409, 'Esta sucursal no vende productos.');
      if (pedidos.length && !config.vendeServicios) throw new ErrorHttp(409, 'Esta sucursal no vende servicios.');

      // Se usa el mismo criterio de IVA con el que se creó la nota, para que sus totales no se mezclen
      const incluyeIva = v.precios_incluyen_iva;
      const hoy = hoyEnZona(turno.zona);

      const productosBase = await armarProductos(db, e, sucursalId, datos.lineas, incluyeIva);
      const serviciosBase = await armarServicios(db, e, sucursalId, hoy, pedidos, config.camposArticulo, incluyeIva);

      // Solo promociones automáticas vigentes (sin descuento manual ni cupón ni puntos)
      const { productos, servicios: serviciosPromo, aplicadas } = await aplicarPromocionesVenta(db, {
        empresaId: e,
        sucursalId,
        zona: turno.zona,
        productos: productosBase,
        servicios: serviciosBase,
        descuentos: undefined,
        config,
        incluyeIva,
        autorizoId: null,
      });

      // Nota financiada: los servicios nuevos heredan el cargo (igual que en una venta nueva)
      const servicios =
        v.financiada && config.financiamientoCargo > 0
          ? serviciosPromo.map((s) => {
              if (s.porCotizar) return s; // el cargo se decide al cotizar
              const calculada = calcularLineaVenta({ precioBase: config.financiamientoCargo, mayoreo: [], cantidad: 1, tasa: s.tasa, incluyeIva });
              return {
                ...s,
                cargo: { calculada, total: calculada.total },
                base: sumarImporte(s.base, calculada.subtotal),
                iva: sumarImporte(s.iva, calculada.iva),
                total: aMonto(aCentavos(s.total) + aCentavos(calculada.total)),
              };
            })
          : serviciosPromo;

      const totales = totalesVenta([
        ...productos.map((l) => l.calculada),
        ...servicios.flatMap((s) => [s.calculada, ...s.extras.map((x) => x.calculada), ...(s.cargo ? [s.cargo.calculada] : [])]),
      ]);

      if (datos.totalMostrado !== undefined && aCentavos(datos.totalMostrado) !== aCentavos(totales.total)) {
        throw new ErrorHttp(409, 'Los precios cambiaron. Revisa el total y vuelve a agregar.');
      }

      const adicion = {
        id: datos.id,
        ventaId,
        sucursalId,
        turnoId: t.id,
        usuarioId: actor.id,
        subtotal: totales.subtotal,
        iva: totales.iva,
        total: totales.total,
      };
      if (!(await repo.insertarAdicion(db, e, adicion))) throw new ErrorHttp(409, 'Esta operación ya se registró');

      // Lo nuevo continúa la numeración de la nota
      const ordenes = await repo.ultimosOrdenes(db, e, ventaId);
      await ventasRepo.insertarPartidas(db, e, ventaId, actor.id, productos, { ordenInicial: ordenes.partidas });
      let orden = ordenes.partidas + productos.length;

      const articuloIds = [];
      for (const g of grupos) {
        articuloIds[g.indice] = await notasRepo.insertarArticuloNota(db, e, {
          ventaId,
          orden: ordenes.articulos + g.indice + 1,
          comentario: g.comentario,
        });
      }
      for (const s of servicios) {
        const partidaId = await notasRepo.insertarServicio(db, e, {
          ventaId,
          orden: ++orden,
          usuarioId: actor.id,
          sucursalId,
          ...s,
          articuloId: s.indiceArticulo == null ? null : articuloIds[s.indiceArticulo],
          cargoFinanciamiento: s.cargo ? s.cargo.total : 0,
        });
        for (const x of s.extras) await notasRepo.insertarExtra(db, e, { ventaId, orden: ++orden, padreId: partidaId, ...x });
      }

      const insertadas = orden - ordenes.partidas;
      if ((await repo.marcarPartidas(db, e, ventaId, datos.id, ordenes.partidas)) !== insertadas) {
        throw new ErrorHttp(409, 'La nota cambió mientras se agregaba. Vuelve a intentarlo.');
      }

      // Los artículos del cliente quedan guardados para su próxima visita
      if (v.cliente_id && servicios.length) await guardarArticulosDeCliente(db, e, v.cliente_id, serviciosBase);

      // La nota crece: se suma lo agregado a sus totales (el saldo sale de aquí)
      const totalNuevo = aMonto(aCentavos(Number(v.total)) + aCentavos(totales.total));
      await repo.actualizarTotales(db, e, ventaId, {
        subtotal: sumarImporte(v.subtotal === null ? null : Number(v.subtotal), totales.subtotal),
        iva: sumarImporte(v.iva === null ? null : Number(v.iva), totales.iva),
        total: totalNuevo,
      });

      await registrarBitacora(db, {
        empresaId: e,
        sucursalId,
        usuarioId: actor.id,
        accion: 'nota.agregar',
        entidad: 'venta',
        entidadUuid: ventaId,
        antes: { total: Number(v.total) },
        despues: {
          adicionId: datos.id,
          folio: v.folio,
          agregado: totales.total,
          totalNuevo,
          productos: productos.length,
          servicios: servicios.length,
          porCotizar: servicios.filter((s) => s.porCotizar).length,
          articulos: grupos.length,
          descuentos: aplicadas,
        },
        ip,
      });

      return respuesta(db, { ...actor, sucursales: [sucursalId] }, ventaId, { id: datos.id, total: totales.total }, false);
    });
  } catch (err) {
    // Dos envíos simultáneos con el mismo id: gana uno, el otro recibe la misma nota
    if (err.code === '23505' && err.constraint === 'venta_adiciones_pkey') {
      const a = await repo.buscarAdicion(pool, e, datos.id);
      if (a && a.venta_id === ventaId) return respuesta(pool, actor, ventaId, a, true);
    }
    throw err;
  }
}