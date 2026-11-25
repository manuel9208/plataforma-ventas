import { aCentavos, aMonto } from './redondeo.js';
import { calcularPartidaConTotal } from './descuentos.js';
import { fechaHoraEnZona } from './horarios.js';
import { permiteDecimales } from './ventas.js';

const c = (v) => Math.round(aCentavos(Number(v ?? 0)));
const falla = (error) => ({ ok: false, error });
const dosDecimales = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const entero = (v) => Number.isInteger(v) && v > 0;

export const MODOS_CUPON = ['porcentaje', 'monto'];
// Sin 0, O, 1 ni I para que no se confundan al dictarlos
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODIGO = /^[A-Z0-9]{4,20}$/;

export const normalizarCodigo = (t) =>
  String(t ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

// bytes: números al azar (0 a 255) que pone el servidor
export const codigoDesdeBytes = (bytes, largo = 8) =>
  Array.from(bytes)
    .slice(0, largo)
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

// Revisa y limpia un cupón. Lo usan el servidor (decide) y la pantalla (avisa).
export function validarCupon(x) {
  const nombre = String(x?.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 2 || nombre.length > 60) return falla('El nombre debe tener entre 2 y 60 letras');
  if (!MODOS_CUPON.includes(x.modo)) return falla('Elige si el cupón es en porcentaje o en pesos');
  const valor = x.valor;
  if (typeof valor !== 'number' || !(valor > 0) || !dosDecimales(valor)) return falla('Escribe cuánto descuenta (máximo 2 decimales)');
  if (x.modo === 'porcentaje' && valor > 99) return falla('El porcentaje no puede pasar de 99');
  if (x.modo === 'monto' && valor > 99999.99) return falla('El descuento es demasiado grande');

  const desde = x.desde ?? null;
  const hasta = x.hasta ?? null;
  if (desde && hasta && desde > hasta) return falla('La fecha final no puede ser anterior a la de inicio');

  const vecesPorCliente = x.vecesPorCliente ?? 1;
  if (!Number.isInteger(vecesPorCliente) || vecesPorCliente < 1 || vecesPorCliente > 100) return falla('Las veces por cliente van de 1 a 100');

  // Un cupón personal no necesita límite de clientes
  const clienteId = x.clienteId ?? null;
  let maxClientes = x.maxClientes ?? null;
  if (clienteId) maxClientes = null;
  else if (maxClientes !== null && (!Number.isInteger(maxClientes) || maxClientes < 1 || maxClientes > 100000)) {
    return falla('El máximo de clientes debe ser un número entero mayor a 0');
  }

  const crudo = String(x.codigo ?? '').trim();
  const codigo = crudo ? normalizarCodigo(crudo) : null;
  if (codigo !== null && !CODIGO.test(codigo)) return falla('El código lleva de 4 a 20 letras o números, sin espacios ni símbolos');

  const sucursales = x.sucursalIds ?? [];
  if (!Array.isArray(sucursales) || !sucursales.every(entero)) return falla('Hay una sucursal inválida');

  return {
    ok: true,
    valor: {
      nombre,
      codigo,
      modo: x.modo,
      valor,
      desde,
      hasta,
      vecesPorCliente,
      maxClientes,
      clienteId,
      sucursalIds: [...new Set(sucursales)].sort((a, b) => a - b),
    },
  };
}

// 'apagado' | 'programado' | 'vencido' | 'agotado' | 'vigente', con la fecha de la zona dada
export function estadoCupon(cupon, { zona, ahora = new Date() }) {
  if (!cupon.encendido) return 'apagado';
  const t = fechaHoraEnZona(zona, ahora);
  if (cupon.desde && t.fecha < cupon.desde) return 'programado';
  if (cupon.hasta && t.fecha > cupon.hasta) return 'vencido';
  if (cupon.maxClientes != null && cupon.clientesUsados >= cupon.maxClientes) return 'agotado';
  return 'vigente';
}

// "10% de descuento" o "$50.00 de descuento"
export const textoCupon = (cupon, dinero = (v) => v.toFixed(2)) =>
  cupon.modo === 'porcentaje' ? `${cupon.valor}% de descuento` : `${dinero(cupon.valor)} de descuento`;

// null si se puede usar; si no, el motivo en palabras sencillas.
// uso: { hoy, sucursalId, clienteId, delCliente (veces que este cliente ya lo usó), clientes (clientes distintos que ya lo usaron) }
export function motivoCuponNoUsable(cupon, uso) {
  if (!cupon.encendido) return 'Este cupón no está disponible.';
  if (cupon.desde && uso.hoy < cupon.desde) return 'Este cupón todavía no empieza.';
  if (cupon.hasta && uso.hoy > cupon.hasta) return 'Este cupón ya venció.';
  if (cupon.sucursalIds.length && !cupon.sucursalIds.includes(Number(uso.sucursalId))) return 'Este cupón no es válido en esta sucursal.';
  if (cupon.clienteId && cupon.clienteId !== uso.clienteId) return 'Este cupón no es para este cliente.';
  if (uso.delCliente >= cupon.vecesPorCliente) return 'Este cliente ya usó este cupón.';
  if (cupon.maxClientes != null && uso.delCliente === 0 && uso.clientes >= cupon.maxClientes) return 'Este cupón ya se agotó.';
  return null;
}

// Partidas que admiten cupón: productos enteros (no granel) y servicios. Nunca extras ni cargo de financiamiento.
// Las claves van por posición (p0, p1… / s0, s1…), igual que las promociones.
export function lineasDeCupon({ productos, servicios }) {
  const todas = [
    ...productos.map((p, i) => ({
      clave: `p${i}`,
      total: p.calculada.total,
      piezas: Math.max(Math.ceil(Number(p.cantidad)), 1),
      descuento: p.descuento,
      entera: Number.isInteger(p.cantidad) && p.unidad != null && !permiteDecimales(p.unidad),
    })),
    ...servicios.map((s, i) => ({ clave: `s${i}`, total: s.calculada.total, piezas: 1, descuento: s.descuento, entera: true })),
  ];
  return { lineas: todas.filter((l) => l.entera), hayDescuento: todas.some((l) => Number(l.descuento ?? 0) > 0) };
}

// Reparte centavos entre las líneas en proporción a su importe; ninguna baja de 1 centavo por pieza
function repartirCentavos(items, objetivoC) {
  const dado = new Map(items.map((i) => [i.clave, 0]));
  let resto = objetivoC;
  for (let vuelta = 0; vuelta < 1000 && resto > 0; vuelta++) {
    const libres = items.filter((i) => dado.get(i.clave) < i.tope);
    if (!libres.length) break;
    const suma = BigInt(libres.reduce((s, i) => s + i.totalC, 0));
    if (suma <= BigInt(0)) break;
    const cuotas = libres.map((i) => {
      const exacto = BigInt(resto) * BigInt(i.totalC);
      return { i, base: Math.min(Number(exacto / suma), i.tope - dado.get(i.clave)), residuo: exacto % suma };
    });
    let repartido = 0;
    for (const q of cuotas) {
      dado.set(q.i.clave, dado.get(q.i.clave) + q.base);
      repartido += q.base;
    }
    for (const q of [...cuotas].sort((a, b) => (a.residuo === b.residuo ? 0 : a.residuo > b.residuo ? -1 : 1))) {
      if (repartido >= resto) break;
      if (dado.get(q.i.clave) < q.i.tope) {
        dado.set(q.i.clave, dado.get(q.i.clave) + 1);
        repartido += 1;
      }
    }
    if (repartido === 0) break;
    resto -= repartido;
  }
  return { dado, sinRepartir: resto };
}

// LA usan el servidor (decide) y la Caja (muestra). Un solo beneficio por nota: si ya hay promoción o descuento, no se usa.
// productos y servicios: las partidas ya con sus promociones. Devuelve { ok: false, error } o { ok: true, descuento, productos, servicios }
export function resolverCupon({ cupon, productos, servicios, incluyeIva }) {
  const { lineas, hayDescuento } = lineasDeCupon({ productos, servicios });
  if (hayDescuento) return falla('Este cupón no se puede usar en una compra con promoción o descuento.');
  if (!lineas.length) return falla('Este cupón no aplica a lo que se está comprando.');

  const items = lineas.map((l) => {
    const totalC = Math.max(c(l.total), 0);
    return { clave: l.clave, totalC, tope: Math.max(totalC - l.piezas, 0) };
  });
  const baseC = items.reduce((s, i) => s + i.totalC, 0);
  const capacidadC = items.reduce((s, i) => s + i.tope, 0);
  const pedidoC = cupon.modo === 'porcentaje' ? Math.round(Number(((baseC * cupon.valor) / 100).toFixed(6))) : c(cupon.valor);
  const descuentoC = Math.min(pedidoC, capacidadC);
  if (descuentoC <= 0) return falla('Este cupón no aplica a lo que se está comprando.');

  const { dado, sinRepartir } = repartirCentavos(items, descuentoC);
  if (sinRepartir > 0) return falla('No se pudo repartir el cupón en esta compra.');

  const rebajar = (partida, centavos) => {
    if (!centavos) return partida;
    const calc = calcularPartidaConTotal({ totalC: c(partida.calculada.total) - centavos, tasa: partida.tasa, incluyeIva });
    return {
      ...partida,
      total: calc.total,
      base: calc.subtotal,
      iva: calc.iva,
      calculada: calc,
      descuentoCupon: aMonto(centavos),
      // El cupón cuenta como descuento (puntos, ticket y reportes). Nunca llega con otro descuento: ya se rechazó arriba.
      descuento: aMonto(centavos),
      promocionNombre: `Cupón ${cupon.codigo}`,
      descuentoOrigen: 'cupon',
    };
  };
  return {
    ok: true,
    descuento: aMonto(descuentoC),
    productos: productos.map((p, i) => rebajar(p, dado.get(`p${i}`))),
    servicios: servicios.map((s, i) => rebajar(s, dado.get(`s${i}`))),
  };
}