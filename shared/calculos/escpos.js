// Convierte un documento de ticketsTermicos.js a los comandos de una impresora térmica (ESC/POS).
// Función pura: sirve para el programa de la PC y, más adelante, para RawBT en Android.
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Letras y signos del español en la tabla PC850 (la que casi todas las térmicas traen)
const CP850 = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, '¿': 0xa8, '¡': 0xad, '·': 0xfa, '°': 0xf8,
};
// Para impresoras que no imprimen acentos, o letras que no existen en la tabla
const SIMPLE = { '·': '-', '–': '-', '—': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '¿': '?', '¡': '!', '°': 'o', '€': 'E' };

function codificar(texto, acentos) {
  const salida = [];
  for (const ch of String(texto ?? '')) {
    const c = ch.codePointAt(0);
    if (c >= 0x20 && c <= 0x7e) {
      salida.push(c);
    } else if (acentos && CP850[ch] !== undefined) {
      salida.push(CP850[ch]);
    } else {
      const base = SIMPLE[ch] ?? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ascii = [...base].map((x) => x.codePointAt(0)).filter((x) => x >= 0x20 && x <= 0x7e);
      if (ascii.length) salida.push(...ascii);
      else if (c >= 0x20) salida.push(0x3f); // "?"
    }
  }
  return salida;
}

const ALINEAR = { izq: 0, centro: 1, der: 2 };

// doc: { renglones, cajon, cortar }
export function documentoAEscPos(doc, { acentos = true } = {}) {
  const b = [ESC, 0x40, ESC, 0x74, acentos ? 2 : 0]; // iniciar + tabla de caracteres
  if (doc.cajon) b.push(ESC, 0x70, 0x00, 0x19, 0xfa); // abrir cajón

  let alinear = 'izq';
  let negrita = false;
  let grande = false;
  for (const r of doc.renglones) {
    if (r.alinear !== alinear) {
      b.push(ESC, 0x61, ALINEAR[r.alinear] ?? 0);
      alinear = r.alinear;
    }
    if (Boolean(r.negrita) !== negrita) {
      negrita = Boolean(r.negrita);
      b.push(ESC, 0x45, negrita ? 1 : 0);
    }
    if (Boolean(r.grande) !== grande) {
      grande = Boolean(r.grande);
      b.push(GS, 0x21, grande ? 0x11 : 0x00);
    }
    for (const x of codificar(r.texto, acentos)) b.push(x);
    b.push(LF);
  }

  b.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0); // todo como estaba
  b.push(ESC, 0x64, doc.cortar ? 5 : 3); // avanzar el papel
  if (doc.cortar) b.push(GS, 0x56, 0x42, 0x00); // cortar
  return Uint8Array.from(b);
}

// Varios documentos seguidos (ej. ticket del cliente y ticket del área) en un solo envío
export function documentosAEscPos(docs, opciones) {
  const partes = docs.map((d) => documentoAEscPos(d, opciones));
  const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

export function bytesABase64(bytes) {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}