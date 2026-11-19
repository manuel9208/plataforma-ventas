import { DIAS, fechaHoraEnZona } from './horarios.js';

export const TIPOS_PROMOCION = [
  { id: 'descuento', nombre: 'Descuento', descripcion: 'Baja el precio de lo que elijas.' },
  { id: 'happy_hour', nombre: 'Happy hour', descripcion: 'Un descuento solo en ciertos días y horas.' },
  { id: 'combo', nombre: 'Combo', descripcion: 'Varios artículos juntos a un precio especial.' },
  { id: 'lleva_paga', nombre: 'Lleva y paga', descripcion: 'Lleva varios y paga menos: 2x1, 3x2, 3 pagando 1.5…' },
];
export const MODOS_DESCUENTO = ['porcentaje', 'monto'];
export const TIPOS_OBJETIVO = ['departamento', 'producto', 'servicio'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const IDS_DIA = DIAS.map((d) => d.id);
const MAX_OBJETIVOS = 100;
const MAX_ARTICULOS_COMBO = 10;
const MAX_LLEVA = 10;

const dosDecimales = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const entero = (v) => Number.isInteger(v) && v > 0;

// Nombre automático de una promoción "lleva y paga": 2x1, 3x2, 3x1.5
export const nombreLlevaPaga = (lleva, paga) => `${lleva}x${paga}`;

// Misma regla que esFechaISO
function fechaOk(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const f = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === s;
}

// "A todo" o "solo a lo que elija". Llena p.aplicaA y p.objetivos. Devuelve el texto del error o null.
function leerAplicaA(x, p) {
  p.aplicaA = x.aplicaA === 'seleccion' ? 'seleccion' : 'todo';
  if (p.aplicaA !== 'seleccion') return null;
  const objetivos = x.objetivos ?? [];
  if (!Array.isArray(objetivos) || objetivos.length === 0) return 'Elige a qué se aplica la promoción';
  if (objetivos.length > MAX_OBJETIVOS) return `Elige máximo ${MAX_OBJETIVOS} artículos o departamentos`;
  const vistos = new Set();
  for (const o of objetivos) {
    if (!TIPOS_OBJETIVO.includes(o?.tipo) || !entero(o?.id)) return 'Hay un artículo inválido en la lista';
    const clave = `${o.tipo}:${o.id}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      p.objetivos.push({ tipo: o.tipo, id: o.id });
    }
  }
  return null;
}

// Revisa y limpia una promoción. Lo usan el servidor (decide) y la pantalla (avisa).
// Combo: cada pieza cuenta 1; las piezas a granel no entran (lo revisa el servidor con la base).
// Lleva y paga: lleva (2 a 10) y paga (mayor a 0 y menor que lleva); el granel se excluye al calcular.
export function validarPromocion(x) {
  const falla = (error) => ({ ok: false, error });
  const nombre = String(x?.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 2 || nombre.length > 60) return falla('El nombre debe tener entre 2 y 60 letras');
  const tipo = x.tipo;
  if (!TIPOS_PROMOCION.some((t) => t.id === tipo)) return falla('Elige el tipo de promoción');

  const p = {
    nombre,
    tipo,
    modo: null,
    valor: null,
    precioCombo: null,
    lleva: null,
    paga: null,
    aplicaA: 'todo',
    objetivos: [],
    items: [],
    sucursalIds: [],
    desde: x.desde ?? null,
    hasta: x.hasta ?? null,
    dias: null,
    horaDesde: null,
    horaHasta: null,
  };

  if (p.desde !== null && !fechaOk(p.desde)) return falla('La fecha de inicio no es válida');
  if (p.hasta !== null && !fechaOk(p.hasta)) return falla('La fecha final no es válida');
  if (p.desde && p.hasta && p.desde > p.hasta) return falla('La fecha final no puede ser anterior a la de inicio');

  const sucursales = x.sucursalIds ?? [];
  if (!Array.isArray(sucursales) || !sucursales.every(entero)) return falla('Hay una sucursal inválida');
  p.sucursalIds = [...new Set(sucursales)].sort((a, b) => a - b);

  if (tipo === 'combo') {
    const precio = x.precioCombo;
    if (typeof precio !== 'number' || !(precio > 0) || precio > 99999.99 || !dosDecimales(precio)) {
      return falla('Escribe el precio del combo (máximo 2 decimales)');
    }
    p.precioCombo = precio;

    const items = x.items ?? [];
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ARTICULOS_COMBO) {
      return falla(`El combo lleva de 1 a ${MAX_ARTICULOS_COMBO} artículos`);
    }
    const vistos = new Set();
    for (const i of items) {
      const cantidad = i?.cantidad ?? 1;
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) return falla('La cantidad de cada artículo va de 1 a 20');
      const esProducto = i?.presentacionId != null;
      const esServicio = i?.servicioId != null;
      if (esProducto === esServicio) return falla('Cada artículo del combo es un producto o un servicio');
      if (esProducto && (!entero(i.presentacionId) || i.tipoArticuloId != null)) return falla('Hay un artículo del combo inválido');
      if (esServicio && (!entero(i.servicioId) || (i.tipoArticuloId != null && !entero(i.tipoArticuloId)))) {
        return falla('Hay un artículo del combo inválido');
      }
      const clave = esProducto ? `p${i.presentacionId}` : `s${i.servicioId}|${i.tipoArticuloId ?? '*'}`;
      if (vistos.has(clave)) return falla('Hay un artículo repetido en el combo');
      vistos.add(clave);
      p.items.push({
        presentacionId: i.presentacionId ?? null,
        servicioId: i.servicioId ?? null,
        tipoArticuloId: i.tipoArticuloId ?? null,
        cantidad,
      });
    }
    if (p.items.reduce((s, i) => s + i.cantidad, 0) < 2) return falla('Un combo necesita al menos dos piezas');
    return { ok: true, valor: p };
  }

  if (tipo === 'lleva_paga') {
    const { lleva, paga } = x;
    if (!Number.isInteger(lleva) || lleva < 2 || lleva > MAX_LLEVA) return falla(`Lo que se lleva es un número entero de 2 a ${MAX_LLEVA}`);
    if (typeof paga !== 'number' || !(paga > 0) || !dosDecimales(paga)) return falla('Escribe cuánto se paga (mayor a 0, máximo 2 decimales)');
    if (paga >= lleva) return falla('Lo que se paga debe ser menos que lo que se lleva');
    p.lleva = lleva;
    p.paga = paga;
    const errorAplica = leerAplicaA(x, p);
    if (errorAplica) return falla(errorAplica);
    return { ok: true, valor: p };
  }

  // Descuento y happy hour
  if (!MODOS_DESCUENTO.includes(x.modo)) return falla('Elige si el descuento es en porcentaje o en dinero');
  const valor = x.valor;
  if (typeof valor !== 'number' || !(valor > 0) || !dosDecimales(valor)) return falla('Escribe cuánto se descuenta (máximo 2 decimales)');
  if (x.modo === 'porcentaje' && valor > 99) return falla('El porcentaje no puede pasar de 99');
  if (x.modo === 'monto' && valor > 99999.99) return falla('El descuento es demasiado grande');
  p.modo = x.modo;
  p.valor = valor;

  const errorAplica = leerAplicaA(x, p);
  if (errorAplica) return falla(errorAplica);

  if (tipo === 'happy_hour') {
    if (!HORA.test(x.horaDesde ?? '') || !HORA.test(x.horaHasta ?? '')) return falla('Escribe de qué hora a qué hora aplica');
    if (x.horaDesde >= x.horaHasta) return falla('La hora final debe ser después de la inicial');
    p.horaDesde = x.horaDesde;
    p.horaHasta = x.horaHasta;
    const dias = x.dias ?? null;
    if (dias !== null) {
      if (!Array.isArray(dias) || !dias.every((d) => IDS_DIA.includes(d))) return falla('Hay un día inválido');
      const unicos = new Set(dias);
      // Todos los días, o ninguno marcado, es lo mismo que "todos los días"
      p.dias = unicos.size === 0 || unicos.size === 7 ? null : IDS_DIA.filter((d) => unicos.has(d));
    }
  }
  return { ok: true, valor: p };
}

// 'apagada' | 'programada' | 'vencida' | 'fuera_de_horario' | 'vigente', según la hora de la zona dada
export function estadoPromocion(p, { zona, ahora = new Date() }) {
  if (!p.encendida) return 'apagada';
  const t = fechaHoraEnZona(zona, ahora);
  if (p.desde && t.fecha < p.desde) return 'programada';
  if (p.hasta && t.fecha > p.hasta) return 'vencida';
  if (p.tipo === 'happy_hour') {
    if (p.dias?.length && !p.dias.includes(t.dia)) return 'fuera_de_horario';
    if (t.hora < p.horaDesde || t.hora >= p.horaHasta) return 'fuera_de_horario';
  }
  return 'vigente';
}

export const promocionVigente = (p, contexto) => estadoPromocion(p, contexto) === 'vigente';

// "10% de descuento", "$50.00 de descuento", "Combo por $250.00", "Lleva 3, paga 1.5". dinero = el formato de moneda de la empresa.
export function textoPromocion(p, dinero = (v) => v.toFixed(2)) {
  if (p.tipo === 'combo') return `Combo por ${dinero(p.precioCombo)}`;
  if (p.tipo === 'lleva_paga') return `Lleva ${p.lleva}, paga ${p.paga}`;
  return p.modo === 'porcentaje' ? `${p.valor}% de descuento` : `${dinero(p.valor)} de descuento`;
}

const fechaCorta = (s) => {
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
};

// "Mar, Jue de 14:00 a 17:00 · Del 01/06/2025 al 30/06/2025" o "Siempre"
export function textoVigencia(p) {
  const partes = [];
  if (p.tipo === 'happy_hour') {
    const dias = p.dias?.length ? p.dias.map((id) => DIAS.find((d) => d.id === id)?.corto).join(', ') : 'Todos los días';
    partes.push(`${dias} de ${p.horaDesde} a ${p.horaHasta}`);
  }
  if (p.desde && p.hasta) partes.push(`Del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}`);
  else if (p.desde) partes.push(`Desde el ${fechaCorta(p.desde)}`);
  else if (p.hasta) partes.push(`Hasta el ${fechaCorta(p.hasta)}`);
  return partes.length ? partes.join(' · ') : 'Siempre';
}