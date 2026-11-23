import {
  aCentavos,
  aMonto,
  aUnidadBase,
  armarFolio,
  calcularLineaVenta,
  hoyEnZona,
  normalizarPagos,
  normalizarPagosNota,
  pagoMinimoNota,
  sumarDias,
  totalesVenta,
  resolverPie,
  validarArticulo,
  validarCantidad,
  aplanarArticulos,
} from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { generarPinEntrega, hashPin } from '../utils/pin.js';
import { moduloActivo } from '../utils/modulos.js';
import { tienePermiso } from '../utils/permisos.js';
import { autorizar } from './autorizacion.service.js';
import { aplicarPromocionesVenta } from './promocionesVenta.service.js';
import * as repo from '../repositories/ventas.repository.js';
import * as notasRepo from '../repositories/notas.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as listaRepo from '../repositories/notasLista.repository.js';
import * as configRepo from '../repositories/configuracion.repository.js';
import { guardarArticulosDeCliente } from './clienteArticulos.service.js';
import { otorgarSeguro } from './puntos.service.js';
import { venta as serializarVenta } from '../serializers/ventas.serializer.js';
import { autorizarCanje, aplicarCanje, registrarCanje } from './canjePuntos.service.js';

const MAX_DIAS_PROMESA = 365;
// Suma dos importes; si alguno no está desglosado (null), el resultado tampoco
const sumarImporte = (a, b) => (a == null || b == null ? null : aMonto(aCentavos(a) + aCentavos(b)));
const NO_DISPONIBLE_PRODUCTO = 'Uno de los productos ya no está disponible en esta sucursal. Actualiza el catálogo.';
const NO_DISPONIBLE_SERVICIO = 'Uno de los servicios ya no está disponible en esta sucursal. Actualiza la pantalla.';

// Pie del ticket con las variables ya resueltas (una línea por renglón)
async function pieDeRecepcion(db, empresaId, sucursalId) {
  const [pies, datos] = await Promise.all([listaRepo.cargarPies(db, empresaId, sucursalId), configRepo.datosParaPie(db, empresaId, sucursalId)]);
  return resolverPie(pies.recepcion, datos).join('\n');
}

async function cargarVenta(db, empresaId, id) {
  const v = await repo.buscarVenta(db, empresaId, id);
  if (!v) return null;
  const [partidas, pagos, nota, pie] = await Promise.all([
    repo.listarPartidas(db, empresaId, id),
    repo.listarPagos(db, empresaId, id),
    notasRepo.cargarNota(db, empresaId, id),
    pieDeRecepcion(db, empresaId, v.sucursal_id),
  ]);
  return { ...serializarVenta(v, partidas, pagos, nota), pieRecepcion: pie };
}

// ---------- Productos: precio de la sucursal, mayoreo e IVA, todo calculado aquí ----------
async function armarProductos(db, e, sucursalId, solicitadas, incluyeIva) {
  if (!solicitadas.length) return [];

  // Mismo producto y presentación en dos líneas: se juntan
  const juntas = new Map();
  for (const l of solicitadas) juntas.set(l.presentacionId, (juntas.get(l.presentacionId) ?? 0) + l.cantidad);

  const filas = await repo.cargarPresentaciones(db, e, sucursalId, [...juntas.keys()]);
  const porId = new Map(filas.map((f) => [f.presentacion_id, f]));

  const lineas = [];
  for (const [presentacionId, cantidadPedida] of juntas) {
    const f = porId.get(presentacionId);
    if (!f || !f.producto_activo || !f.presentacion_activa || !f.se_vende || !f.en_sucursal || f.precio === null) {
      throw new ErrorHttp(409, NO_DISPONIBLE_PRODUCTO);
    }
    const cantidad = Number(cantidadPedida.toFixed(3));
    if (!validarCantidad(cantidad, f.unidad_base)) throw new ErrorHttp(400, `Cantidad inválida para ${f.producto_nombre}`);

    const mayoreo = f.mayoreo.map((m) => ({ cantidadMinima: Number(m.cantidadMinima), precio: Number(m.precio) }));
    const c = calcularLineaVenta({ precioBase: Number(f.precio), mayoreo, cantidad, tasa: Number(f.tasa), incluyeIva });
    lineas.push({
      clave: `p${presentacionId}`,
      departamentoId: Number(f.departamento_id),
      productoId: f.producto_id,
      presentacionId,
      nombre:
        f.presentacion_nombre.toLowerCase() === f.producto_nombre.toLowerCase()
          ? f.producto_nombre
          : `${f.producto_nombre} · ${f.presentacion_nombre}`,
      sku: f.sku,
      unidad: f.unidad,
      factor: Number(f.factor),
      cantidad,
      cantidadBase: aUnidadBase(cantidad, Number(f.factor)),
      precioLista: Number(f.precio),
      precioAplicado: c.precioAplicado,
      origenPrecio: c.origenPrecio ?? (f.precio_de_sucursal ? 'sucursal' : 'general'),
      tasa: Number(f.tasa),
      base: c.subtotal,
      iva: c.iva,
      total: c.total,
      calculada: c,
    });
  }
  return lineas;
}

// ---------- Servicios: un artículo = un servicio, con sus extras y sus datos ----------
async function armarServicios(db, e, sucursalId, hoy, solicitados, camposArticulo, incluyeIva) {
  if (!solicitados.length) return [];

  const servicioIds = [...new Set(solicitados.map((s) => s.servicioId))];
  const porServicio = new Map((await notasRepo.cargarServicios(db, e, sucursalId, servicioIds)).map((f) => [f.id, f]));

  const precios = await notasRepo.cargarPrecios(
    db,
    e,
    sucursalId,
    solicitados.map((s) => s.servicioId),
    solicitados.map((s) => s.tipoArticuloId)
  );
  const porPar = new Map(precios.map((p) => [`${p.servicio_id}|${p.tipo_id}`, p]));

  const extraIds = [...new Set(solicitados.flatMap((s) => s.extraIds))];
  const extras = extraIds.length ? await notasRepo.cargarExtras(db, e, sucursalId, servicioIds, extraIds) : [];
  const extraPorPar = new Map(extras.map((x) => [`${x.servicio_id}|${x.extra_id}`, x]));

  return solicitados.map((s, indice) => {
    const sv = porServicio.get(s.servicioId);
    if (!sv || !sv.activo || !sv.departamento_activo || !sv.en_sucursal) throw new ErrorHttp(409, NO_DISPONIBLE_SERVICIO);

    const p = porPar.get(`${s.servicioId}|${s.tipoArticuloId}`);
    if (!p || !p.tipo_activo) throw new ErrorHttp(409, `El servicio "${sv.nombre}" no se ofrece para ese tipo de artículo.`);

    const { datos: articulo, error } = validarArticulo(s.articulo, camposArticulo);
    if (error) throw new ErrorHttp(400, `${p.tipo_nombre}: ${error}`);

    // Fecha prometida: la que dice el servicio (en días) a partir de hoy, o la que eligió el cajero
    const dias = sv.tiempo_estimado_horas == null ? 0 : Math.round(sv.tiempo_estimado_horas / 24);
    let fechaPrometida = sumarDias(hoy, dias);
    if (s.fechaPrometida) {
      if (s.fechaPrometida < hoy) throw new ErrorHttp(400, 'La fecha prometida no puede ser anterior a hoy');
      if (s.fechaPrometida > sumarDias(hoy, MAX_DIAS_PROMESA)) throw new ErrorHttp(400, 'La fecha prometida está demasiado lejos');
      fechaPrometida = s.fechaPrometida;
    }

    const general = Number(p.precio_general);
    const aplicado = Number(p.precio_sucursal ?? p.precio_general);
    const c = calcularLineaVenta({ precioBase: aplicado, mayoreo: [], cantidad: 1, tasa: Number(sv.tasa), incluyeIva });

    const extrasLinea = [...new Set(s.extraIds)].map((extraId) => {
      const x = extraPorPar.get(`${s.servicioId}|${extraId}`);
      if (!x || !x.activo) throw new ErrorHttp(409, 'Uno de los extras ya no está disponible para ese servicio.');
      const xAplicado = Number(x.precio_sucursal ?? x.precio_general);
      const cx = calcularLineaVenta({ precioBase: xAplicado, mayoreo: [], cantidad: 1, tasa: Number(x.tasa), incluyeIva });
      return {
        extraId,
        nombre: x.nombre,
        precioLista: Number(x.precio_general),
        precioAplicado: xAplicado,
        origenPrecio: x.precio_sucursal != null ? 'sucursal' : 'general',
        tasa: Number(x.tasa),
        base: cx.subtotal,
        iva: cx.iva,
        total: cx.total,
        calculada: cx,
      };
    });

    return {
      servicioId: s.servicioId,
      tipoArticuloId: s.tipoArticuloId,
      tipoNombre: p.tipo_nombre,
      nombre: `${sv.nombre} · ${p.tipo_nombre}`,
      sku: sv.sku,
      precioLista: general,
      precioAplicado: aplicado,
      origenPrecio: p.precio_sucursal != null ? 'sucursal' : 'general',
      tasa: Number(sv.tasa),
      base: c.subtotal,
      iva: c.iva,
      total: c.total,
      clave: `s${indice}`,
      indiceArticulo: s.indiceArticulo ?? null,
      departamentoId: Number(sv.departamento_id),
      fechaPrometida,
      articulo,
      extras: extrasLinea,
      calculada: c,
    };
  });
}

// Crea la venta o nota. Todo lo que importa (precios, mayoreo, IVA, total, abono) lo decide el servidor.
export async function crear(actor, datos, ip) {
  if (actor.esGlobal) throw new ErrorHttp(403, 'El administrador global no opera cajas');
  const e = actor.empresaId;

  // Reintento de una venta ya guardada: se devuelve la misma, sin volver a cobrar ni a generar otro PIN
  const existente = await repo.buscarVenta(pool, e, datos.id);
  if (existente) {
    if (existente.usuario_id !== actor.id) throw new ErrorHttp(409, 'Esa venta ya existe');
    return { ...(await cargarVenta(pool, e, datos.id)), repetida: true, pinEntrega: null };
  }

  const turno = await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  if (!turno) throw new ErrorHttp(409, 'Abre tu turno para vender');
  if (turno.de_otro_dia) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');

  // Si la nota viene por artículos (varios servicios por artículo) se aplana a la lista de servicios, en orden:
  // las claves s0, s1… de las promociones y del descuento manual salen de ese orden
  const { servicios: serviciosPedidos, grupos } = datos.articulos?.length
    ? aplanarArticulos(datos.articulos)
    : { servicios: datos.servicios, grupos: [] };
  datos = { ...datos, servicios: serviciosPedidos };

  // El PIN solo existe si hay servicios; se guarda cifrado y se devuelve una única vez
  const pin = datos.servicios.length ? generarPinEntrega() : null;
  const pinHash = pin ? await hashPin(pin) : null;

  // Descuento manual: lo autoriza un encargado con su PIN, antes de la transacción (los intentos fallidos se guardan aparte)
  let autorizo = null;
  if (datos.descuentos) {
    if (!(await moduloActivo(e, 'promociones'))) throw new ErrorHttp(403, 'Este módulo no está activo en tu plan');
    autorizo = await autorizar(actor, turno.sucursal_id, datos.descuentos.autorizacion, 'caja.descuentos');
  }

  // Canje de puntos: lo autoriza el cliente con su PIN o un encargado
  const autorizoCanje = datos.canje ? await autorizarCanje(actor, turno.sucursal_id, datos) : null;

  try {
    return await conTransaccion(async (db) => {
      // El turno se bloquea durante la venta: no se puede cerrar a la mitad de un cobro
      const t = await repo.bloquearTurno(db, e, turno.id);
      if (!t || t.cerrado_en) throw new ErrorHttp(409, 'Tu turno ya está cerrado');
      if (t.vencido) throw new ErrorHttp(409, 'Tu turno es de otro día. Ciérralo y abre uno nuevo.');
      if (t.usuario_id !== actor.id) throw new ErrorHttp(403, 'Ese turno no es tuyo');
      const sucursalId = t.sucursal_id;

      const config = await notasRepo.cargarConfig(db, e, sucursalId);
      // Lo apagado en Configuración no se puede vender, aunque alguien lo pida por la fuerza
      if (datos.lineas.length && !config.vendeProductos) throw new ErrorHttp(409, 'Esta sucursal no vende productos.');
      if (datos.servicios.length && !config.vendeServicios) throw new ErrorHttp(409, 'Esta sucursal no vende servicios.');

      // Financiar: sin anticipo de servicios y con un cargo por servicio. Lo decide la configuración y el permiso del usuario.
      const financiada = datos.financiada === true;
      if (financiada) {
        if (!datos.servicios.length) throw new ErrorHttp(400, 'El financiamiento solo aplica a notas con servicios');
        if (!config.financiamientoActivo) throw new ErrorHttp(409, 'El financiamiento no está activo en esta sucursal.');
        if (!tienePermiso(actor.permisos, 'caja.financiar')) throw new ErrorHttp(403, 'No tienes permiso para financiar notas');
      }
      const incluyeIva = await repo.preciosIncluyenIva(db, e);
      const hoy = hoyEnZona(turno.zona);

      const productosBase = await armarProductos(db, e, sucursalId, datos.lineas, incluyeIva);
      const serviciosBase = await armarServicios(db, e, sucursalId, hoy, datos.servicios, config.camposArticulo, incluyeIva);

      // Promociones vigentes y descuento manual: el servidor decide los precios finales
      const { productos: productosPromo, servicios: serviciosPromo, aplicadas } = await aplicarPromocionesVenta(db, {
        empresaId: e,
        sucursalId,
        zona: turno.zona,
        productos: productosBase,
        servicios: serviciosBase,
        descuentos: datos.descuentos,
        config,
        incluyeIva,
        autorizoId: autorizo?.id ?? null,
      });

      // Puntos: se rebajan las partidas después de las promociones y antes del cargo de financiamiento
      const conCanje = datos.canje
        ? await aplicarCanje(db, {
            empresaId: e,
            sucursalId,
            clienteId: datos.clienteId,
            puntos: datos.canje.puntos,
            productos: productosPromo,
            servicios: serviciosPromo,
            incluyeIva,
          })
        : null;
      const productos = conCanje?.productos ?? productosPromo;
      const serviciosConPromo = conCanje?.servicios ?? serviciosPromo;

      // El cargo ya incluye IVA y no recibe promociones ni descuentos: se suma al total de cada servicio (los extras no llevan cargo)
      const servicios =
        financiada && config.financiamientoCargo > 0
          ? serviciosConPromo.map((s) => {
              const calculada = calcularLineaVenta({ precioBase: config.financiamientoCargo, mayoreo: [], cantidad: 1, tasa: s.tasa, incluyeIva });
              return {
                ...s,
                cargo: { calculada, total: calculada.total },
                base: sumarImporte(s.base, calculada.subtotal),
                iva: sumarImporte(s.iva, calculada.iva),
                total: aMonto(aCentavos(s.total) + aCentavos(calculada.total)),
              };
            })
          : serviciosConPromo;

      // Sin teléfono no hay aviso por WhatsApp ni PIN: en notas con servicios el cliente es obligatorio
      if (servicios.length && !datos.clienteId && !datos.clienteNuevo) {
        throw new ErrorHttp(400, 'Para una nota de servicio el cliente es obligatorio (teléfono y nombre)');
      }

      const calculadas = [
        ...productos.map((l) => l.calculada),
        ...servicios.flatMap((s) => [s.calculada, ...s.extras.map((x) => x.calculada), ...(s.cargo ? [s.cargo.calculada] : [])]),
      ];
      const totales = totalesVenta(calculadas);

      // Si una promoción cambió mientras se cobraba, se avisa claro (la Caja vuelve a pedir las promociones)
      if (datos.totalMostrado !== undefined && aCentavos(datos.totalMostrado) !== aCentavos(totales.total)) {
        throw new ErrorHttp(409, 'Los precios cambiaron. Revisa el total y vuelve a cobrar.');
      }

      const centServicios = servicios.reduce(
        (suma, s) =>
          suma + aCentavos(s.calculada.total) + s.extras.reduce((a, x) => a + aCentavos(x.calculada.total), 0) + (s.cargo ? aCentavos(s.cargo.calculada.total) : 0),
        0
      );
      const totalServicios = aMonto(centServicios);
      const totalProductos = aMonto(aCentavos(totales.total) - centServicios);

      let pagos;
      try {
        if (!servicios.length) {
          pagos = normalizarPagos(totales.total, datos.pagos);
        } else {
          const minimo = pagoMinimoNota({
            totalProductos,
            totalServicios,
            porcentaje: config.abonoPorcentaje,
            esMinimo: config.abonoEsMinimo,
            financiada,
          });
          pagos = normalizarPagosNota(totales.total, datos.pagos, minimo);
        }
      } catch (err) {
        throw new ErrorHttp(400, err.message);
      }

      // Cliente: existente, nuevo (se registra aquí) o ninguno
      let clienteId = null;
      if (datos.clienteId) {
        if (!(await repo.clienteActivo(db, e, datos.clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');
        clienteId = datos.clienteId;
      } else if (datos.clienteNuevo) {
        const previo = await repo.buscarClientePorTelefono(db, e, datos.clienteNuevo.telefono);
        if (previo) {
          if (!previo.activo) throw new ErrorHttp(409, 'Ese teléfono pertenece a un cliente dado de baja');
          clienteId = previo.id;
        } else {
          clienteId = await clientesRepo.insertar(db, e, { ...datos.clienteNuevo, aceptaWhatsapp: false, usuarioId: actor.id });
          await registrarBitacora(db, {
            empresaId: e,
            sucursalId,
            usuarioId: actor.id,
            accion: 'cliente.crear',
            entidad: 'cliente',
            entidadUuid: clienteId,
            despues: { nombre: datos.clienteNuevo.nombre, desdeCaja: true },
            ip,
          });
        }
      }

      const prefijo = await repo.obtenerOAsignarPrefijo(db, e, sucursalId);
      const numero = await repo.siguienteFolio(db, e, sucursalId);
      const folio = armarFolio(prefijo, numero);

      const creada = await repo.insertarVenta(db, e, {
        id: datos.id,
        sucursalId,
        folio,
        folioNumero: numero,
        cajaId: t.caja_id,
        turnoId: t.id,
        usuarioId: actor.id,
        clienteId,
        incluyeIva,
        subtotal: totales.subtotal,
        iva: totales.iva,
        total: totales.total,
      });
      if (!creada) throw new ErrorHttp(409, 'Esa venta ya existe');

      // Primero los productos (se entregan al cobrar), luego cada servicio con sus extras
      await repo.insertarPartidas(db, e, datos.id, actor.id, productos);
      let orden = productos.length;
      // Los artículos de la nota (cada uno agrupa sus servicios); sin artículos queda como siempre
      const articuloIds = [];
      for (const g of grupos) {
        articuloIds[g.indice] = await notasRepo.insertarArticuloNota(db, e, {
          ventaId: datos.id,
          orden: g.indice + 1,
          comentario: g.comentario,
        });
      }
      for (const s of servicios) {
        const partidaId = await notasRepo.insertarServicio(db, e, {
          ventaId: datos.id,
          orden: ++orden,
          usuarioId: actor.id,
          sucursalId,
          ...s,
          articuloId: s.indiceArticulo == null ? null : articuloIds[s.indiceArticulo],
          cargoFinanciamiento: s.cargo ? s.cargo.total : 0,
        });
        for (const x of s.extras) {
          await notasRepo.insertarExtra(db, e, { ventaId: datos.id, orden: ++orden, padreId: partidaId, ...x });
        }
      }

      // Los artículos del cliente quedan guardados para su próxima visita (si falla, el cobro no se detiene)
      if (clienteId && servicios.length) await guardarArticulosDeCliente(db, e, clienteId, serviciosBase);

      const conPin = servicios.length > 0 && config.pinEntregaActivo;
      if (servicios.length) await notasRepo.marcarNota(db, e, datos.id, conPin ? pinHash : null, financiada);

      await repo.insertarPagos(db, e, { id: datos.id, turnoId: t.id, cajaId: t.caja_id, usuarioId: actor.id }, pagos);

      // Puntos de los productos (los de servicios se ganan al entregar). Si falla, el cobro no se detiene.
      if (conCanje) {
        await registrarCanje(db, { empresaId: e, sucursalId, clienteId: datos.clienteId, ventaId: datos.id, usuarioId: actor.id, canje: conCanje.canje });
      }
      // Una compra pagada con puntos no gana puntos
      const puntos = conCanje ? null : await otorgarSeguro(db, {
        empresaId: e,
        sucursalId,
        clienteId,
        tipo: 'productos',
        origen: 'venta',
        ventaId: datos.id,
        clave: `venta:${datos.id}`,
        usuarioId: actor.id,
        lineas: productos.map((p) => ({ base: p.total, descuento: p.descuento ?? 0 })),
      });

      await registrarBitacora(db, {
        empresaId: e,
        sucursalId,
        usuarioId: actor.id,
        accion: servicios.length ? 'nota.crear' : 'venta.crear',
        entidad: 'venta',
        entidadUuid: datos.id,
        // Nunca se registra el PIN
        despues: {
          folio,
          total: totales.total,
          productos: productos.length,
          servicios: servicios.length,
          articulos: grupos.length,
          pinEmitido: conPin,
          financiada,
          descuentos: aplicadas,
          descuentoManual: datos.descuentos ? { motivo: datos.descuentos.motivo, autorizadoPor: autorizo.id } : null,
          canje: conCanje ? { puntos: conCanje.canje.puntos, descuento: conCanje.canje.descuento, metodo: autorizoCanje.metodo, autorizadoPor: autorizoCanje.autorizoId } : null,
          pagos: pagos.map((p) => ({ forma: p.forma, monto: p.monto })),
        },
        ip,
      });

      return { ...(await cargarVenta(db, e, datos.id)), repetida: false, pinEntrega: conPin ? pin : null, puntos };
    });
  } catch (err) {
    // Dos envíos simultáneos con el mismo id: gana uno, el otro recibe la misma venta
    if (err.code === '23505' && err.constraint === 'ventas_pkey') {
      const v = await cargarVenta(pool, e, datos.id);
      if (v) return { ...v, repetida: true, pinEntrega: null };
    }
    throw err;
  }
}