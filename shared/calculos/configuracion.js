import { CAMPOS_ARTICULO, CAMPOS_ARTICULO_DEFECTO } from './articulos.js';
import { validarDiasEspeciales, validarHorario } from './horarios.js';

// Tipos que guardan texto: si nadie los llenó, su valor es '' y no null
export const TIPOS_TEXTO = ['texto', 'linea', 'telefono', 'correo'];

// Lista declarativa de lo que el cliente cambia en Configuración.
// "subclave": el ajuste vive dentro de una columna JSONB (los datos del artículo).
// Un ajuste nuevo = una columna en empresa_config y sucursal_config + una línea aquí.
// nivel: 'ambos' (empresa y sucursal) o 'empresa'. giros: si se indica, solo aparece en esos giros.
export const GRUPOS_CONFIG = [
  { id: 'vender', nombre: 'Qué vendo', descripcion: 'Lo que ofrece esta sucursal en la caja.' },
  { id: 'cobro', nombre: 'Cobro', descripcion: 'Abonos y avisos de efectivo.' },
  { id: 'puntos', nombre: 'Puntos', descripcion: 'Los clientes con perfil completo juntan puntos al comprar. Requiere el módulo de Promociones.' },
  { id: 'metas', nombre: 'Metas de venta', descripcion: 'Cuánto esperas crecer frente a periodos anteriores. Se usa en Reportes.' },
  { id: 'tickets', nombre: 'Tickets', descripcion: 'El texto que sale al final de cada ticket.' },
  { id: 'entrega', nombre: 'Entrega', descripcion: 'Cómo se entregan los trabajos terminados.' },
  { id: 'articulo', nombre: 'Datos del artículo', descripcion: 'Lo que la caja pide al recibir cada artículo.' },
  { id: 'catalogo', nombre: 'Precios e inventario', descripcion: 'IVA y existencias.' },
  { id: 'contacto', nombre: 'Contacto y redes', descripcion: 'Cómo te encuentran tus clientes. También lo usará la atención automática.' },
  { id: 'horario', nombre: 'Horario', descripcion: 'Los días y horas en que atiendes. Si una sucursal no tiene el suyo, usa el de la empresa.', ancho: true },
];

const OPCIONES_NIVEL = [
  { valor: 'obligatorio', etiqueta: 'Obligatorio' },
  { valor: 'opcional', etiqueta: 'Opcional' },
  { valor: 'oculto', etiqueta: 'No lo pido' },
];

const AYUDA_CAMPO = {
  marca: 'Ejemplo: Nike o Adidas.',
  talla: 'Ejemplo: 27 o M.',
  color: 'Ejemplo: blanco con negro.',
  modelo: 'Ejemplo: Air Force 1.',
  textura: 'Ejemplo: gamuza, piel o tela.',
  descripcion: 'Detalles con los que llega: manchas, roturas o golpes.',
};

export const AJUSTES = [
  {
    clave: 'vendeProductos',
    columna: 'vende_productos',
    grupo: 'vender',
    tipo: 'booleano',
    nivel: 'ambos',
    etiqueta: 'Vendo productos',
    descripcion: 'Apágalo si no vendes productos.',
  },
  {
    clave: 'vendeServicios',
    columna: 'vende_servicios',
    grupo: 'vender',
    tipo: 'booleano',
    nivel: 'ambos',
    giros: ['limpieza'],
    etiqueta: 'Vendo servicios',
    descripcion: 'Apágalo si no recibes trabajos. Las notas que ya estén abiertas se siguen cobrando y entregando.',
  },
  {
    clave: 'vistaInicial',
    columna: 'vista_inicial',
    grupo: 'vender',
    tipo: 'opcion',
    nivel: 'ambos',
    giros: ['limpieza'],
    opciones: [
      { valor: 'servicios', etiqueta: 'Servicios' },
      { valor: 'productos', etiqueta: 'Productos' },
    ],
    etiqueta: '¿Qué ve primero la caja?',
    descripcion: 'Lo que aparece al abrir la caja. Si apagaste una de las dos, se usa la otra.',
  },
  {
    clave: 'abonoPorcentaje',
    columna: 'abono_porcentaje',
    grupo: 'cobro',
    tipo: 'numero',
    nivel: 'ambos',
    giros: ['limpieza'],
    min: 0,
    max: 100,
    etiqueta: 'Abono sugerido (%)',
    descripcion: 'Porcentaje de los servicios que se cobra al recibir la nota.',
  },
  {
    clave: 'abonoEsMinimo',
    columna: 'abono_es_minimo',
    grupo: 'cobro',
    tipo: 'booleano',
    nivel: 'ambos',
    giros: ['limpieza'],
    etiqueta: 'Exigir el abono',
    descripcion: 'Si está encendido, la caja no deja guardar una nota con menos de ese abono.',
  },
  {
    clave: 'financiamientoActivo',
    columna: 'financiamiento_activo',
    grupo: 'cobro',
    tipo: 'booleano',
    nivel: 'ambos',
    giros: ['limpieza'],
    etiqueta: 'Permitir financiar notas',
    descripcion: 'Al financiar, la nota no pide anticipo de los servicios y se cobra el cargo de abajo por cada servicio. Los productos de la nota se pagan completos.',
  },
  {
    clave: 'financiamientoCargo',
    columna: 'financiamiento_cargo',
    grupo: 'cobro',
    tipo: 'dinero',
    nivel: 'ambos',
    giros: ['limpieza'],
    min: 0,
    max: 9999.99,
    etiqueta: 'Cargo por financiamiento (por servicio)',
    descripcion: 'Monto que se suma a cada servicio financiado. Ya incluye el IVA. Escribe 0 para financiar sin cargo.',
  },
  {
    clave: 'retiroEfectivoLimite',
    columna: 'retiro_efectivo_limite',
    grupo: 'cobro',
    tipo: 'dinero',
    nivel: 'ambos',
    min: 0,
    max: 9999999.99,
    etiqueta: 'Avisar para retirar efectivo desde',
    descripcion: 'Cuando las ventas en efectivo del turno llegan a este monto, la caja pide retirarlo. Escribe 0 para no avisar.',
  },
  {
    clave: 'descuentoManualMax',
    columna: 'descuento_manual_max',
    grupo: 'cobro',
    tipo: 'numero',
    nivel: 'ambos',
    min: 0,
    max: 99,
    etiqueta: 'Descuento manual máximo (%)',
    descripcion: 'Lo más que un gerente puede descontar a mano en una venta. Escribe 0 para no permitirlo.',
  },
  {
    clave: 'puntosGanarProductos',
    columna: 'puntos_ganar_productos',
    grupo: 'puntos',
    tipo: 'booleano',
    nivel: 'ambos',
    etiqueta: 'Los productos dan puntos',
    descripcion: 'Los puntos de un producto se ganan al cobrar.',
  },
  {
    clave: 'puntosMontoProductos',
    columna: 'puntos_monto_productos',
    grupo: 'puntos',
    tipo: 'dinero',
    nivel: 'ambos',
    min: 0.01,
    max: 99999.99,
    etiqueta: 'Productos: por cada ($)',
    descripcion: 'Cada vez que el cliente paga esta cantidad en productos, gana los puntos de abajo.',
  },
  {
    clave: 'puntosGanadosProductos',
    columna: 'puntos_ganados_productos',
    grupo: 'puntos',
    tipo: 'numero',
    nivel: 'ambos',
    min: 0,
    max: 9999,
    etiqueta: 'Productos: puntos que gana',
    descripcion: 'Ejemplo: por cada $100, 10 puntos.',
  },
  {
    clave: 'puntosGanarServicios',
    columna: 'puntos_ganar_servicios',
    grupo: 'puntos',
    tipo: 'booleano',
    nivel: 'ambos',
    giros: ['limpieza'],
    etiqueta: 'Los servicios dan puntos',
    descripcion: 'Los puntos de un servicio se ganan al entregarlo. Una nota cancelada no da puntos.',
  },
  {
    clave: 'puntosMontoServicios',
    columna: 'puntos_monto_servicios',
    grupo: 'puntos',
    tipo: 'dinero',
    nivel: 'ambos',
    giros: ['limpieza'],
    min: 0.01,
    max: 99999.99,
    etiqueta: 'Servicios: por cada ($)',
    descripcion: 'Cada vez que el cliente paga esta cantidad en servicios, gana los puntos de abajo. El financiamiento no cuenta.',
  },
  {
    clave: 'puntosGanadosServicios',
    columna: 'puntos_ganados_servicios',
    grupo: 'puntos',
    tipo: 'numero',
    nivel: 'ambos',
    giros: ['limpieza'],
    min: 0,
    max: 9999,
    etiqueta: 'Servicios: puntos que gana',
    descripcion: 'Ejemplo: por cada $100, 10 puntos.',
  },
  {
    clave: 'puntosValor',
    columna: 'puntos_valor',
    grupo: 'puntos',
    tipo: 'dinero',
    nivel: 'ambos',
    min: 0.01,
    max: 999.99,
    etiqueta: 'Cuánto vale cada punto ($)',
    descripcion: 'Servirá para canjear. Ejemplo: 0.50 significa que 100 puntos valen $50.',
  },
  {
    clave: 'puntosPromoDa',
    columna: 'puntos_promo_da',
    grupo: 'puntos',
    tipo: 'booleano',
    nivel: 'ambos',
    etiqueta: 'Un artículo con promoción o descuento da puntos',
    descripcion: 'Si lo apagas, lo que se compra con promoción o descuento no suma puntos.',
  },
  {
    clave: 'puntosCaducidad',
    columna: 'puntos_caducidad',
    grupo: 'puntos',
    tipo: 'opcion',
    nivel: 'ambos',
    opciones: [
      { valor: 'nunca', etiqueta: 'No caducan' },
      { valor: 'meses', etiqueta: 'Caducan a los meses' },
    ],
    etiqueta: '¿Los puntos caducan?',
    descripcion: 'Solo cambia los puntos que se ganen de aquí en adelante.',
  },
  {
    clave: 'puntosCaducidadMeses',
    columna: 'puntos_caducidad_meses',
    grupo: 'puntos',
    tipo: 'numero',
    nivel: 'ambos',
    min: 1,
    max: 120,
    etiqueta: 'Meses para que caduquen',
    descripcion: 'Solo se usa si elegiste "Caducan a los meses". Usa números enteros.',
  },
  {
    clave: 'puntosExigirAviso',
    columna: 'puntos_exigir_aviso',
    grupo: 'puntos',
    tipo: 'booleano',
    nivel: 'ambos',
    etiqueta: 'Exigir que el cliente haya entrado a Mi cuenta',
    descripcion: 'Además del perfil completo, el cliente debe haber aceptado el aviso de privacidad al entrar a Mi cuenta.',
  },
  {
    clave: 'metaCrecimiento',
    columna: 'meta_crecimiento',
    grupo: 'metas',
    tipo: 'numero',
    nivel: 'ambos',
    min: 0,
    max: 100,
    etiqueta: 'Meta de crecimiento (%)',
    descripcion: 'La meta de venta es lo que vendiste en el periodo de comparación más este porcentaje. Ejemplo: 5 significa vender 5% más.',
  },
  {
    clave: 'pieTicketRecepcion',
    columna: 'pie_ticket_recepcion',
    grupo: 'tickets',
    tipo: 'texto',
    nivel: 'ambos',
    max: 600,
    etiqueta: 'Pie del ticket al recibir o vender',
    descripcion: 'Texto al final del ticket. Una línea con un dato vacío no se imprime.',
  },
  {
    clave: 'pieTicketEntrega',
    columna: 'pie_ticket_entrega',
    grupo: 'tickets',
    tipo: 'texto',
    nivel: 'ambos',
    giros: ['limpieza'],
    max: 600,
    etiqueta: 'Pie del ticket de entrega',
    descripcion: 'Texto al final del ticket que se da al entregar.',
  },
  {
    clave: 'pinEntregaActivo',
    columna: 'pin_entrega_activo',
    grupo: 'entrega',
    tipo: 'booleano',
    nivel: 'ambos',
    giros: ['limpieza'],
    etiqueta: 'Pedir el PIN al entregar',
    descripcion: 'El cliente recibe un PIN al dejar sus artículos y lo da al recogerlos. Si lo apagas, basta confirmar la entrega.',
  },
  // Un ajuste por cada dato del artículo. La clave es camelCase porque el validador no admite guiones bajos.
  ...CAMPOS_ARTICULO.map(({ clave, etiqueta }) => ({
    clave: `articulo${clave[0].toUpperCase()}${clave.slice(1)}`,
    columna: 'campos_articulo',
    subclave: clave,
    grupo: 'articulo',
    tipo: 'opcion',
    nivel: 'ambos',
    giros: ['limpieza'],
    opciones: OPCIONES_NIVEL,
    defecto: CAMPOS_ARTICULO_DEFECTO[clave],
    etiqueta,
    descripcion: AYUDA_CAMPO[clave],
  })),
  {
    clave: 'preciosIncluyenIva',
    columna: 'precios_incluyen_iva',
    grupo: 'catalogo',
    tipo: 'booleano',
    nivel: 'empresa',
    etiqueta: 'Los precios incluyen IVA',
    descripcion: 'Encendido: el IVA se desglosa del precio y sale en el ticket. Apagado: el precio es el total y no se muestra IVA. No cambia los tickets anteriores.',
  },
  {
    clave: 'permitirVentaSinExistencia',
    columna: 'permitir_venta_sin_existencia',
    grupo: 'catalogo',
    tipo: 'booleano',
    nivel: 'empresa',
    etiqueta: 'Permitir vender sin existencia',
    descripcion: 'Se usará cuando llegue el inventario: encendido, la caja deja vender aunque marque cero.',
  },
  {
    clave: 'contactoWhatsapp',
    columna: 'contacto_whatsapp',
    grupo: 'contacto',
    tipo: 'telefono',
    nivel: 'ambos',
    etiqueta: 'WhatsApp para clientes',
    descripcion: '10 dígitos. El número al que te escriben tus clientes.',
  },
  {
    clave: 'contactoCorreo',
    columna: 'contacto_correo',
    grupo: 'contacto',
    tipo: 'correo',
    nivel: 'ambos',
    etiqueta: 'Correo de contacto',
    descripcion: 'Opcional.',
  },
  {
    clave: 'redFacebook',
    columna: 'red_facebook',
    grupo: 'contacto',
    tipo: 'linea',
    nivel: 'ambos',
    max: 150,
    etiqueta: 'Facebook',
    descripcion: 'Enlace o nombre de tu página.',
  },
  {
    clave: 'redInstagram',
    columna: 'red_instagram',
    grupo: 'contacto',
    tipo: 'linea',
    nivel: 'ambos',
    max: 150,
    etiqueta: 'Instagram',
    descripcion: 'Enlace o @usuario.',
  },
  {
    clave: 'redTiktok',
    columna: 'red_tiktok',
    grupo: 'contacto',
    tipo: 'linea',
    nivel: 'ambos',
    max: 150,
    etiqueta: 'TikTok',
    descripcion: 'Enlace o @usuario.',
  },
  {
    clave: 'sitioWeb',
    columna: 'sitio_web',
    grupo: 'contacto',
    tipo: 'linea',
    nivel: 'ambos',
    max: 150,
    etiqueta: 'Sitio web',
    descripcion: 'Opcional.',
  },
  {
    clave: 'horario',
    columna: 'horario',
    grupo: 'horario',
    tipo: 'horario',
    nivel: 'ambos',
    etiqueta: 'Horario de la semana',
    descripcion: 'Marca los días que abres y a qué hora.',
  },
  {
    clave: 'diasEspeciales',
    columna: 'dias_especiales',
    grupo: 'horario',
    tipo: 'fechas',
    nivel: 'ambos',
    etiqueta: 'Días especiales',
    descripcion: 'Festivos o fechas con horario distinto. Tienen prioridad sobre el horario de la semana.',
  },
];

// Datos que se pueden escribir entre llaves en el pie del ticket
export const VARIABLES_PIE = [
  { clave: 'empresa', etiqueta: 'Nombre de la empresa' },
  { clave: 'sucursal', etiqueta: 'Nombre de la sucursal' },
  { clave: 'direccion', etiqueta: 'Dirección' },
  { clave: 'telefono_sucursal', etiqueta: 'Teléfono de la sucursal' },
];

export const ajustesVisibles = (giro) => AJUSTES.filter((a) => !a.giros || a.giros.includes(giro));

const dosDecimales = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

// Devuelve { ok: true, valor } con el valor limpio, o { ok: false, error }
export function validarAjuste(def, valor) {
  const nombre = def.etiqueta;
  switch (def.tipo) {
    case 'booleano':
      return typeof valor === 'boolean' ? { ok: true, valor } : { ok: false, error: `${nombre}: elige sí o no` };
    case 'numero':
    case 'dinero': {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return { ok: false, error: `${nombre}: escribe un número` };
      if (valor < def.min || valor > def.max) return { ok: false, error: `${nombre}: debe estar entre ${def.min} y ${def.max}` };
      if (!dosDecimales(valor)) return { ok: false, error: `${nombre}: máximo 2 decimales` };
      return { ok: true, valor };
    }
    case 'texto': {
      if (typeof valor !== 'string') return { ok: false, error: `${nombre}: escribe un texto` };
      const limpio = valor
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .trim();
      if (limpio.length > def.max) return { ok: false, error: `${nombre}: máximo ${def.max} caracteres` };
      return { ok: true, valor: limpio };
    }
    case 'opcion':
      return def.opciones.some((o) => o.valor === valor) ? { ok: true, valor } : { ok: false, error: `${nombre}: opción no válida` };
    case 'linea': {
      if (typeof valor !== 'string') return { ok: false, error: `${nombre}: escribe un texto` };
      const limpio = valor.replace(/\s+/g, ' ').trim();
      if (limpio.length > def.max) return { ok: false, error: `${nombre}: máximo ${def.max} caracteres` };
      return { ok: true, valor: limpio };
    }
    case 'telefono': {
      if (typeof valor !== 'string') return { ok: false, error: `${nombre}: escribe un teléfono` };
      const digitos = valor.replace(/\D/g, '');
      if (digitos && digitos.length !== 10) return { ok: false, error: `${nombre}: escribe los 10 dígitos` };
      return { ok: true, valor: digitos };
    }
    case 'correo': {
      if (typeof valor !== 'string') return { ok: false, error: `${nombre}: escribe un correo` };
      const limpio = valor.trim().toLowerCase();
      if (limpio.length > 120) return { ok: false, error: `${nombre}: máximo 120 caracteres` };
      if (limpio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return { ok: false, error: `${nombre}: el correo no parece válido` };
      return { ok: true, valor: limpio };
    }
    case 'horario': {
      const r = validarHorario(valor);
      return r.ok ? { ok: true, valor: r.valor } : { ok: false, error: `${nombre}: ${r.error}` };
    }
    case 'fechas': {
      const r = validarDiasEspeciales(valor);
      return r.ok ? { ok: true, valor: r.valor } : { ok: false, error: `${nombre}: ${r.error}` };
    }
    default:
      return { ok: false, error: `${nombre}: ajuste desconocido` };
  }
}

// Qué se vende en una sucursal: la sucursal manda, si no la empresa. Los servicios solo existen en limpieza.
// Una sucursal con valor vacío (null o undefined) hereda el de la empresa.
export function queSeVende({ giro, empresa = {}, sucursal = {} }) {
  const esLimpieza = giro === 'limpieza';
  const vendeProductos = (sucursal.vendeProductos ?? empresa.vendeProductos ?? true) === true;
  const vendeServicios = esLimpieza && (sucursal.vendeServicios ?? empresa.vendeServicios ?? true) === true;
  const pedida = sucursal.vistaInicial ?? empresa.vistaInicial ?? 'servicios';
  const opciones = [vendeServicios && 'servicios', vendeProductos && 'productos'].filter(Boolean);
  const vistaInicial = opciones.includes(pedida) ? pedida : (opciones[0] ?? 'productos');
  return { vendeProductos, vendeServicios, vistaInicial };
}