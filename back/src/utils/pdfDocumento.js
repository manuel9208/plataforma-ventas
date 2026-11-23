import PDFDocument from 'pdfkit';

export const COLOR = {
  primario: '#1d2b4f',
  acento: '#c9a25c',
  texto: '#161d33',
  suave: '#6b7280',
  borde: '#e8e2d6',
  crema: '#f3efe6',
  verde: '#047857',
  rojo: '#b91c1c',
  ambar: '#b45309',
};
const MARGEN = 30;

// Mide con la fuente que esté puesta. Recorta con "..." si no cabe.
function recortar(doc, texto, ancho) {
  let t = String(texto ?? '');
  if (doc.widthOfString(t) <= ancho) return t;
  while (t.length > 1 && doc.widthOfString(`${t}...`) > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function envolver(doc, texto, ancho, maxLineas) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (doc.widthOfString(prueba) <= ancho) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = doc.widthOfString(p) <= ancho ? p : recortar(doc, p, ancho);
  }
  if (actual) lineas.push(actual);
  if (!lineas.length) return [''];
  if (lineas.length > maxLineas) {
    const corte = lineas.slice(0, maxLineas);
    corte[maxLineas - 1] = recortar(doc, lineas.slice(maxLineas - 1).join(' '), ancho);
    return corte;
  }
  return lineas;
}

// Documento PDF horizontal, armado en memoria. Al terminar entrega un Buffer.
export class DocumentoPdf {
  constructor({ tamano = 'A4', titulo = '', autor = '', pie = '' }) {
    this.doc = new PDFDocument({ size: tamano, layout: 'landscape', margin: MARGEN, bufferPages: true, info: { Title: titulo, Author: autor } });
    this.pie = pie;
    const partes = [];
    this.doc.on('data', (c) => partes.push(c));
    this.terminado = new Promise((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(partes)));
      this.doc.on('error', reject);
    });
  }

  get ancho() {
    return this.doc.page.width - MARGEN * 2;
  }

  get fondoUtil() {
    return this.doc.page.height - MARGEN - 20;
  }

  asegurar(alto) {
    if (this.doc.y + alto > this.fondoUtil) this.doc.addPage();
  }

  nuevaPagina() {
    this.doc.addPage();
  }

  encabezado({ empresa, titulo, derecha, lineas }) {
    const d = this.doc;
    d.rect(0, 0, d.page.width, 70).fill(COLOR.primario);
    d.rect(0, 70, d.page.width, 3).fill(COLOR.acento);
    d.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(empresa, MARGEN, 18, { width: this.ancho * 0.65, lineBreak: false });
    d.fillColor('#d7dcea').font('Helvetica').fontSize(11).text(titulo, MARGEN, 45, { width: this.ancho * 0.65, lineBreak: false });
    d.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(derecha, MARGEN, 30, { width: this.ancho, align: 'right', lineBreak: false });
    d.y = 82;
    for (const l of lineas.filter(Boolean)) {
      d.font('Helvetica').fontSize(9).fillColor(COLOR.suave).text(l, MARGEN, d.y, { width: this.ancho });
    }
    d.y += 10;
  }

  seccion(titulo, nota) {
    const d = this.doc;
    this.asegurar(110);
    d.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.primario).text(titulo, MARGEN, d.y, { width: this.ancho });
    if (nota) d.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave).text(nota, MARGEN, d.y, { width: this.ancho });
    d.y += 6;
  }

  subtitulo(texto) {
    const d = this.doc;
    this.asegurar(70);
    d.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.texto).text(texto, MARGEN, d.y, { width: this.ancho });
    d.y += 4;
  }

  parrafo(texto, { color = COLOR.texto, tam = 9, negrita = false } = {}) {
    const d = this.doc;
    d.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(tam).fillColor(color);
    this.asegurar(d.heightOfString(texto, { width: this.ancho }) + 6);
    d.text(texto, MARGEN, d.y, { width: this.ancho });
    d.y += 8;
  }

  // items: [{ titulo, valor, nota, destacada, color }]
  tarjetas(items) {
    const d = this.doc;
    const alto = 64;
    const sep = 10;
    const w = (this.ancho - sep * (items.length - 1)) / items.length;
    this.asegurar(alto + 14);
    const y = d.y;
    items.forEach((it, i) => {
      const x = MARGEN + i * (w + sep);
      d.roundedRect(x, y, w, alto, 8).lineWidth(0.7).fillAndStroke(it.destacada ? COLOR.primario : '#ffffff', it.destacada ? COLOR.primario : COLOR.borde);
      const suave = it.destacada ? '#d7dcea' : COLOR.suave;
      d.font('Helvetica').fontSize(8.5).fillColor(suave).text(it.titulo, x + 10, y + 9, { width: w - 20, lineBreak: false });
      d.font('Helvetica-Bold').fontSize(17).fillColor(it.destacada ? '#ffffff' : (it.color ?? COLOR.texto)).text(it.valor, x + 10, y + 23, { width: w - 20, lineBreak: false });
      d.font('Helvetica').fontSize(7.5).fillColor(suave).text(it.nota ?? '', x + 10, y + 47, { width: w - 20, lineBreak: false });
    });
    d.y = y + alto + 12;
  }

  // columnas: [{ etiqueta, peso, alinear, envolver }] · filas: [[texto…]] o [{ celdas, negrita, suave, fondo }]
  tabla({ columnas, filas, fuente = 8, filaTotal = null, x = MARGEN, ancho = this.ancho, vacio = 'Sin datos en este periodo.' }) {
    const d = this.doc;
    if (!filas.length) {
      this.parrafo(vacio, { color: COLOR.suave });
      return;
    }
    const suma = columnas.reduce((s, c) => s + (c.peso ?? 1), 0);
    const anchos = columnas.map((c) => ((c.peso ?? 1) / suma) * ancho);
    const pad = 4;
    d.font('Helvetica').fontSize(fuente);
    const lh = d.currentLineHeight(true);

    const medir = (celdas, negrita) => {
      d.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuente);
      const lineas = celdas.map((t, i) =>
        columnas[i].envolver ? envolver(d, t, anchos[i] - pad * 2, columnas[i].envolver) : [recortar(d, t, anchos[i] - pad * 2)]
      );
      return { lineas, alto: Math.max(...lineas.map((l) => l.length)) * lh + 8 };
    };

    const dibujar = (m, { fondo, negrita, color }) => {
      const y = d.y;
      if (fondo) d.rect(x, y, ancho, m.alto).fill(fondo);
      d.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuente).fillColor(color ?? COLOR.texto);
      let cx = x;
      m.lineas.forEach((lineas, i) => {
        lineas.forEach((l, k) => {
          d.text(l, cx + pad, y + 4 + k * lh, { width: anchos[i] - pad * 2, align: columnas[i].alinear ?? 'left', lineBreak: false });
        });
        cx += anchos[i];
      });
      d.moveTo(x, y + m.alto).lineTo(x + ancho, y + m.alto).lineWidth(0.3).stroke(COLOR.borde);
      d.y = y + m.alto;
    };

    const cab = medir(columnas.map((c) => c.etiqueta), true);
    const pintarEncabezado = () => dibujar(cab, { fondo: COLOR.primario, negrita: true, color: '#ffffff' });

    this.asegurar(cab.alto + 40);
    pintarEncabezado();
    filas.forEach((f, idx) => {
      const fila = Array.isArray(f) ? { celdas: f } : f;
      const m = medir(fila.celdas.map((t) => String(t ?? '')), fila.negrita);
      if (d.y + m.alto > this.fondoUtil) {
        d.addPage();
        pintarEncabezado();
      }
      dibujar(m, { fondo: fila.fondo ?? (idx % 2 ? '#faf8f3' : null), negrita: fila.negrita, color: fila.suave ? COLOR.suave : fila.color });
    });
    if (filaTotal) {
      const m = medir(filaTotal.map((t) => String(t ?? '')), true);
      if (d.y + m.alto > this.fondoUtil) {
        d.addPage();
        pintarEncabezado();
      }
      dibujar(m, { fondo: COLOR.crema, negrita: true });
    }
    d.y += 12;
  }

  // filas: [{ hora, abierta, sinVentas, valores: { [idSerie]: monto } }] · series: [{ id, etiqueta }]
  graficaHoras({ filas, series, colores, textoHora }) {
    const d = this.doc;
    if (!filas.length) return;
    const alto = 120;
    this.asegurar(alto + 70);

    let lx = MARGEN;
    const ly = d.y;
    series.forEach((s, i) => {
      d.rect(lx, ly + 2, 8, 8).fill(colores[i] ?? colores[colores.length - 1]);
      d.font('Helvetica').fontSize(8).fillColor(COLOR.texto).text(s.etiqueta, lx + 12, ly, { lineBreak: false });
      lx += 12 + d.widthOfString(s.etiqueta) + 18;
    });

    const top = ly + 20;
    const base = top + alto;
    const grupo = this.ancho / filas.length;
    const max = Math.max(1, ...filas.flatMap((f) => series.map((s) => f.valores[s.id] ?? 0)));
    const bw = Math.min(14, (grupo * 0.8) / series.length);

    filas.forEach((f, k) => {
      const gx = MARGEN + k * grupo;
      if (f.sinVentas) d.rect(gx + 1, top, grupo - 2, alto).fill('#fef3c7');
      const inicio = gx + (grupo - bw * series.length) / 2;
      series.forEach((s, i) => {
        const v = f.valores[s.id] ?? 0;
        if (v > 0) {
          const h = Math.max(2, (v / max) * alto);
          d.rect(inicio + i * bw, base - h, bw - 1, h).fill(colores[i] ?? colores[colores.length - 1]);
        }
      });
      d.font('Helvetica').fontSize(7).fillColor(f.abierta ? COLOR.texto : '#a3a3a3').text(textoHora(f.hora), gx, base + 3, { width: grupo, align: 'center', lineBreak: false });
    });
    d.moveTo(MARGEN, base).lineTo(MARGEN + this.ancho, base).lineWidth(0.5).stroke(COLOR.borde);
    d.y = base + 20;
  }

  // Pie con fecha, quién lo generó y número de página en todas las hojas
  async terminar() {
    const d = this.doc;
    const rango = d.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      d.switchToPage(rango.start + i);
      const margenAbajo = d.page.margins.bottom;
      d.page.margins.bottom = 0; // sin esto, escribir en el pie crearía hojas nuevas
      const y = d.page.height - 24;
      d.moveTo(MARGEN, y - 6).lineTo(MARGEN + this.ancho, y - 6).lineWidth(0.4).stroke(COLOR.borde);
      d.font('Helvetica').fontSize(7.5).fillColor(COLOR.suave);
      d.text(this.pie, MARGEN, y, { width: this.ancho - 90, align: 'left', lineBreak: false });
      d.text(`Página ${i + 1} de ${rango.count}`, MARGEN, y, { width: this.ancho, align: 'right', lineBreak: false });
      d.page.margins.bottom = margenAbajo;
    }
    d.end();
    return this.terminado;
  }
}