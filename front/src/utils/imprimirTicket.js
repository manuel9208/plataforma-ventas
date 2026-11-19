import { bytesABase64, documentosAEscPos, nombreUnidad, totalAhorro } from '@plataforma/calculos';
import { ETIQUETA_FORMA } from './formasPago.js';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda, formatearTelefono } from './formato.js';
import { enviarAlPuente, leerConfigImpresora } from './puenteImpresion.js';

// Los espacios "especiales" que mete Intl se cambian por uno normal para que no descuadren el papel
const limpio = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ');

// Lo que los tickets de shared/calculos necesitan de la pantalla
export const formatoTicket = (moneda) => ({
  dinero: (v) => limpio(formatearMoneda(v, moneda)),
  fechaHora: (iso, zona) => limpio(formatearFechaHora(iso, zona)),
  fechaLarga: formatearFechaLarga,
  etiquetaForma: (f) => ETIQUETA_FORMA[f] ?? f,
  nombreUnidad,
  totalAhorro,
  telefono: formatearTelefono,
});

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Impresión del navegador. Cada columna mide 1.5 mm: 32 columnas = 48 mm (papel de 58) y 48 columnas = 72 mm (papel de 80).
function imprimirEnNavegador(lista) {
  const { ancho, columnas } = lista[0];

  const cuerpo = lista
    .map(
      (d) =>
        `<section>${d.renglones
          .map((r) => `<div class="r ${r.alinear} ${r.negrita ? 'n' : ''} ${r.grande ? 'g' : ''}">${esc(r.texto) || '&nbsp;'}</div>`)
          .join('')}</section>`
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
@page { size: ${ancho}mm auto; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${ancho}mm; font-family: 'Courier New', Courier, monospace; font-size: 9.45px; line-height: 1.25; color: #000; }
section { width: ${columnas}ch; margin: 0 auto; padding: 2mm 0 6mm; page-break-after: always; }
section:last-child { page-break-after: auto; }
.r { white-space: pre; }
.centro { text-align: center; }
.der { text-align: right; }
.n { font-weight: bold; }
.g { font-size: 2em; line-height: 1.1; }
</style></head><body>${cuerpo}</body></html>`;

  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  marco.srcdoc = html;
  marco.onload = () => {
    marco.contentWindow.focus();
    marco.contentWindow.print();
    setTimeout(() => marco.remove(), 60000);
  };
  document.body.appendChild(marco);
}

// Imprime uno o varios documentos con lo que esta computadora tenga configurado:
// el programa de la caja (corta el papel y abre el cajón) o el navegador. Si el programa falla, usa el navegador.
// Devuelve { via: 'puente' | 'navegador' | 'ninguna', aviso? }
export async function imprimirDocumentos(docs) {
  const lista = docs.filter(Boolean);
  if (!lista.length) return { via: 'ninguna' };

  const cfg = leerConfigImpresora();
  if (cfg.via === 'puente') {
    try {
      await enviarAlPuente(bytesABase64(documentosAEscPos(lista, { acentos: cfg.acentos })), cfg.destino);
      return { via: 'puente' };
    } catch (e) {
      imprimirEnNavegador(lista);
      return { via: 'navegador', aviso: `No se pudo imprimir con el programa de la caja (${e.message}). Se abrió la impresión del navegador.` };
    }
  }
  imprimirEnNavegador(lista);
  return { via: 'navegador' };
}