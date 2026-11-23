// Tickets para impresora térmica (58 y 80 mm). UN solo formato para el navegador y para el programa puente:
// primero se arma un "documento" (renglones ya partidos al ancho del papel) y cada salida solo lo dibuja.
// Funciones puras. Lo que depende de la pantalla llega en `fmt`:
//   fmt.dinero(v) · fmt.fechaHora(iso, zona) · fmt.fechaLarga(fechaISO) · fmt.etiquetaForma(forma)
//   fmt.nombreUnidad(unidad) · fmt.totalAhorro(partidas) · fmt.telefono(t) (opcional)

export const ANCHOS_PAPEL = [58, 80];
const COLUMNAS = { 58: 32, 80: 48 };
export const columnasDe = (ancho) => COLUMNAS[ancho] ?? COLUMNAS[80];

const ESTADO_PAGO = { pendiente: 'Sin pago', abonada: 'Abonada', pagada: 'Pagada' };
const CENTRO = { alinear: 'centro' };
const CENTRO_NEGRITA = { alinear: 'centro', negrita: true };

// Parte un texto en renglones de máximo `max` letras, sin cortar palabras (salvo que una sola no quepa)
function envolver(texto, max) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio || max < 1) return [];
  const lineas = [];
  let actual = '';
  for (let palabra of limpio.split(' ')) {
    while (palabra.length > max) {
      if (actual) {
        lineas.push(actual);
        actual = '';
      }
      lineas.push(palabra.slice(0, max));
      palabra = palabra.slice(max);
    }
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= max) actual += ` ${palabra}`;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function crearDocumento(ancho, { cajon = false, cortar = true } = {}) {
  const cols = columnasDe(ancho);
  const renglones = [];
  const poner = (texto, alinear = 'izq', negrita = false, grande = false) => renglones.push({ texto, alinear, negrita, grande });

  const doc = {
    texto(t, { alinear = 'izq', negrita = false, grande = false, sangria = 0 } = {}) {
      const max = (grande ? Math.floor(cols / 2) : cols) - sangria;
      const pre = ' '.repeat(sangria);
      for (const l of envolver(t, max)) poner(pre + l, alinear, negrita, grande);
      return doc;
    },
    // Texto a la izquierda y un importe a la derecha, en el mismo renglón
    fila(izq, der, { negrita = false, sangria = 0 } = {}) {
      const d = String(der ?? '');
      const ancho_izq = cols - d.length - 1 - sangria;
      if (ancho_izq < 8) {
        doc.texto(izq, { negrita, sangria });
        poner(d, 'der', negrita);
        return doc;
      }
      const pre = ' '.repeat(sangria);
      const partes = envolver(izq, ancho_izq);
      if (!partes.length) partes.push('');
      partes.forEach((p, i) => {
        const base = pre + p;
        poner(i === 0 ? base.padEnd(cols - d.length) + d : base, 'izq', negrita);
      });
      return doc;
    },
    // "[ ] Servicio": casilla para marcar a mano
    casilla(t, { negrita = false } = {}) {
      envolver(t, cols - 4).forEach((l, i) => poner((i === 0 ? '[ ] ' : '    ') + l, 'izq', negrita));
      return doc;
    },
    linea: (c = '-') => (poner(c.repeat(cols)), doc),
    espacio: () => (poner(''), doc),
    resultado: () => ({ ancho, columnas: cols, renglones, cajon, cortar }),
  };
  return doc;
}

// Los servicios de una nota agrupados por artículo físico (notas viejas: un artículo por servicio)
export function agruparPorArticulo(servicios = []) {
  const grupos = [];
  const porId = new Map();
  for (const s of servicios) {
    const id = s.articuloId ?? `p${s.partidaId}`;
    let g = porId.get(id);
    if (!g) {
      g = { id, articulo: s.articulo ?? {}, comentario: s.comentario ?? null, servicios: [] };
      porId.set(id, g);
      grupos.push(g);
    }
    g.servicios.push(s);
  }
  return grupos;
}

const datosDeArticulo = (articulo) => Object.values(articulo ?? {}).filter(Boolean).join(' · ');

// ---------- Ticket del cliente ----------
export function ticketCliente(venta, { ancho = 80, empresa = '', esCopia = false, abrirCajon = false, corte = true, fmt }) {
  const esNota = venta.tieneServicios;
  const productos = venta.partidas.filter((p) => p.tipo === 'producto');
  // El cajón solo se abre con dinero en efectivo (y nunca en una copia)
  const hayEfectivo = venta.pagos.some((p) => p.forma === 'efectivo' && p.monto > 0);
  const t = crearDocumento(ancho, { cajon: abrirCajon && hayEfectivo && !esCopia, cortar: corte });
  const cambio = venta.pagos.reduce((s, p) => s + (p.cambio ?? 0), 0);
  const telefono = (x) => (fmt.telefono ? fmt.telefono(x) : x);

  if (esCopia) t.texto('*** COPIA ***', CENTRO_NEGRITA);
  t.texto(empresa, CENTRO_NEGRITA);
  t.texto(venta.sucursal, CENTRO);
  t.texto(esNota ? 'NOTA DE SERVICIO' : 'VENTA', CENTRO);
  t.texto(venta.folio, { ...CENTRO_NEGRITA, grande: true });
  t.texto(fmt.fechaHora(venta.creadaEn, venta.zonaHoraria), CENTRO);
  t.texto([venta.caja, venta.cajero].filter(Boolean).join(' · '), CENTRO);
  if (venta.cliente) t.texto(`${venta.cliente.nombre} · ${telefono(venta.cliente.telefono)}`, CENTRO);
  t.linea();

  if (esNota) {
    for (const g of agruparPorArticulo(venta.servicios)) {
      const datos = datosDeArticulo(g.articulo);
      if (datos) t.texto(datos, { negrita: true });
      for (const s of g.servicios) {
        t.fila(s.nombre, fmt.dinero(s.total));
        if (s.promocion) t.texto(`${s.promocion} · ahorro ${fmt.dinero(s.descuento)}`, { sangria: 2 });
        for (const x of s.extras) t.fila(`+ ${x.nombre}`, fmt.dinero(x.total), { sangria: 2 });
        if (s.cargoFinanciamiento > 0) t.texto(`Incluye financiamiento ${fmt.dinero(s.cargoFinanciamiento)}`, { sangria: 2 });
        t.texto(`Entrega: ${fmt.fechaLarga(s.fechaPrometida)}`, { sangria: 2 });
      }
      t.espacio();
    }
  }

  for (const p of productos) {
    t.fila(p.nombre, fmt.dinero(p.total));
    const unidad = fmt.nombreUnidad(p.unidad ?? 'pieza').toLowerCase();
    t.texto(`${p.cantidad} ${unidad} x ${fmt.dinero(p.precioAplicado)}${p.origenPrecio === 'mayoreo' ? ' (mayoreo)' : ''}`, { sangria: 2 });
    if (p.promocion) t.texto(`${p.promocion} · ahorro ${fmt.dinero(p.descuento)}`, { sangria: 2 });
  }

  t.linea();
  if (venta.preciosIncluyenIva && venta.subtotal !== null) {
    t.fila('Subtotal', fmt.dinero(venta.subtotal));
    t.fila('IVA', fmt.dinero(venta.iva));
  }
  const ahorro = fmt.totalAhorro([...productos, ...venta.servicios]);
  if (ahorro > 0) t.fila('Ahorraste', fmt.dinero(ahorro));
  if (venta.canje) {
    t.fila('Pagado con puntos', fmt.dinero(venta.canje.descuento));
    t.texto(`${venta.canje.puntos} puntos, ya descontados`, { sangria: 2 });
  }
  t.fila('TOTAL', fmt.dinero(venta.total), { negrita: true });
  t.linea();

  if (venta.pagos.length === 0) t.texto('Sin pago', CENTRO);
  for (const p of venta.pagos) t.fila(`${fmt.etiquetaForma(p.forma)}${p.referencia ? ` · ${p.referencia}` : ''}`, fmt.dinero(p.monto));
  if (cambio > 0) t.fila('Cambio', fmt.dinero(cambio));
  if (esNota) {
    t.fila('Pagado', fmt.dinero(venta.pagado));
    t.fila(`Saldo · ${ESTADO_PAGO[venta.estadoPago] ?? ''}`, fmt.dinero(venta.saldo), { negrita: true });
  }

  // El PIN solo sale en el ticket recién cobrado (nunca en una copia)
  if (venta.pinEntrega) {
    t.linea();
    t.texto('PIN DE ENTREGA', CENTRO);
    t.texto(String(venta.pinEntrega).split('').join(' '), { ...CENTRO_NEGRITA, grande: true });
    t.texto('Lo necesitas para recoger tus articulos.', CENTRO);
  }

  // Puntos que ganó con esta compra (solo en el ticket recién cobrado)
  if (!esCopia && venta.puntos?.ganados > 0) {
    t.linea();
    t.texto(`Ganaste ${venta.puntos.ganados} ${venta.puntos.ganados === 1 ? 'punto' : 'puntos'}`, CENTRO_NEGRITA);
  }

  if (venta.pieRecepcion) {
    t.linea();
    for (const l of String(venta.pieRecepcion).split('\n')) t.texto(l, CENTRO);
  }
  t.espacio();
  return t.resultado();
}

// ---------- Ticket del área de limpieza: sin precios ni PIN, con una casilla por servicio ----------
export function ticketArea(venta, { ancho = 80, corte = true, fmt }) {
  const grupos = agruparPorArticulo(venta.servicios.filter((s) => s.estado !== 'cancelado'));
  if (!grupos.length) return null;
  const t = crearDocumento(ancho, { cajon: false, cortar: corte });

  t.texto('AREA DE LIMPIEZA', CENTRO_NEGRITA);
  t.texto(venta.folio, { ...CENTRO_NEGRITA, grande: true });
  t.texto(`Recibida: ${fmt.fechaHora(venta.creadaEn, venta.zonaHoraria)}`, CENTRO);
  if (venta.cliente) {
    t.texto(venta.cliente.nombre, CENTRO);
    if (venta.cliente.telefono) t.texto(fmt.telefono ? fmt.telefono(venta.cliente.telefono) : venta.cliente.telefono, CENTRO);
  }
  t.linea();

  for (const g of grupos) {
    const datos = datosDeArticulo(g.articulo);
    if (datos) t.texto(datos, { negrita: true });
    if (g.comentario) t.texto(`Nota: ${g.comentario}`);
    for (const s of g.servicios) {
      t.casilla(s.nombre);
      for (const x of s.extras) t.texto(`+ ${x.nombre}`, { sangria: 4 });
      t.texto(`Entrega: ${fmt.fechaLarga(s.fechaPrometida)}`, { sangria: 4 });
    }
    t.espacio();
  }
  t.linea();
  t.espacio();
  return t.resultado();
}

// Lo que se imprime al recibir una nota o una venta: el ticket del cliente y, si aplica, el del área
// opciones: { ancho, corte, abrirCajon, imprimirArea, empresa, esCopia, fmt }
export function ticketsDeRecepcion(venta, opciones) {
  const docs = [ticketCliente(venta, opciones)];
  if (venta.tieneServicios && opciones.imprimirArea && !opciones.esCopia) {
    const area = ticketArea(venta, opciones);
    if (area) docs.push(area);
  }
  return docs;
}

// Ticket de prueba para revisar el ancho del papel y la impresora
export function ticketPrueba({ ancho = 80, empresa = '', corte = true, abrirCajon = false } = {}) {
  const cols = columnasDe(ancho);
  const t = crearDocumento(ancho, { cajon: abrirCajon, cortar: corte });
  t.texto('PRUEBA DE IMPRESION', CENTRO_NEGRITA);
  if (empresa) t.texto(empresa, CENTRO);
  t.texto(`Papel de ${ancho} mm · ${cols} columnas`, CENTRO);
  t.linea();
  t.texto('1234567890'.repeat(5).slice(0, cols));
  t.fila('Texto a la izquierda', '$123.00');
  t.fila('TOTAL', '$1,234.00', { negrita: true });
  t.casilla('Casilla para marcar');
  t.texto('Acentos: áéíóú ÁÉÍÓÚ ñ Ñ ¿? ¡!');
  t.texto('Texto grande', { ...CENTRO_NEGRITA, grande: true });
  t.linea();
  t.texto('Si la regla de numeros sale completa y no se corta nada a los lados, el ancho es correcto.', CENTRO);
  t.espacio();
  return t.resultado();
}

// ---------- Ticket de entrega: lo entregado hoy y lo que falta ----------
// ticket: el ticket de entrega de la pantalla + faltan: [{ nombre, articulo, extras, estado, fechaPrometida }]
export function ticketEntregaTermico(ticket, { ancho = 80, corte = true, empresa = '', fmt }) {
  const t = crearDocumento(ancho, { cajon: false, cortar: corte });
  const faltan = ticket.faltan ?? [];
  const telefono = (x) => (fmt.telefono ? fmt.telefono(x) : x);

  t.texto(empresa, CENTRO_NEGRITA);
  t.texto(ticket.sucursal, CENTRO);
  t.texto('ENTREGA', CENTRO);
  t.texto(ticket.folio, { ...CENTRO_NEGRITA, grande: true });
  t.texto(fmt.fechaHora(ticket.entregadaEn, ticket.zonaHoraria), CENTRO);
  t.texto([ticket.caja, ticket.entrego].filter(Boolean).join(' · '), CENTRO);
  if (ticket.cliente) t.texto(`${ticket.cliente.nombre} · ${telefono(ticket.cliente.telefono)}`, CENTRO);
  t.linea();

  t.texto('ENTREGADO HOY', { negrita: true });
  let anterior = '';
  for (const a of ticket.articulos) {
    const datos = datosDeArticulo(a.articulo);
    if (datos && datos !== anterior) t.texto(datos, { negrita: true });
    anterior = datos;
    t.texto(`[x] ${a.nombre}`);
    for (const x of a.extras ?? []) t.texto(`+ ${x}`, { sangria: 4 });
  }
  t.espacio();

  if (faltan.length) {
    t.texto(`PENDIENTE POR ENTREGAR (${faltan.length})`, { negrita: true });
    anterior = '';
    for (const s of faltan) {
      const datos = datosDeArticulo(s.articulo);
      if (datos && datos !== anterior) t.texto(datos, { negrita: true });
      anterior = datos;
      t.texto(`[ ] ${s.nombre}`);
      for (const x of s.extras ?? []) t.texto(`+ ${x.nombre}`, { sangria: 4 });
      t.texto(`${s.estado === 'listo' ? 'Listo para recoger' : 'En espera'} · Entrega: ${fmt.fechaLarga(s.fechaPrometida)}`, { sangria: 4 });
    }
  } else {
    t.texto('NOTA ENTREGADA COMPLETA', CENTRO_NEGRITA);
  }

  t.linea();
  if (ticket.recoge) t.fila('Recogió', ticket.recoge);
  t.fila('Forma', fmt.etiquetaMetodo(ticket.metodo));
  if (ticket.motivo) t.fila('Motivo', ticket.motivo);

  if (ticket.puntos?.ganados > 0) {
    t.linea();
    t.texto(`Ganaste ${ticket.puntos.ganados} ${ticket.puntos.ganados === 1 ? 'punto' : 'puntos'}`, CENTRO_NEGRITA);
  }

  if (ticket.pieEntrega) {
    t.linea();
    for (const l of String(ticket.pieEntrega).split('\n')) t.texto(l, CENTRO);
  }
  t.espacio();
  return t.resultado();
}