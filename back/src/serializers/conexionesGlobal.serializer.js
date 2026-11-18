import { enmascarar } from '../utils/cifrado.js';

// "baileys:Baileys (no oficial)" -> { valor, etiqueta }
const opcionesDe = (v) =>
  (v.opciones ?? []).map((o) => {
    const i = o.indexOf(':');
    return { valor: o.slice(0, i), etiqueta: o.slice(i + 1) };
  });

// Nunca sale un secreto: solo enmascarado. Lo que no es secreto sale completo.
export function variableVista(v, cifrado, leer) {
  const valor = cifrado ? leer(cifrado) : null;
  return {
    clave: v.clave,
    etiqueta: v.etiqueta ?? v.clave,
    descripcion: v.descripcion,
    tipo: v.tipo,
    opciones: opcionesDe(v),
    esSecreto: v.es_secreto,
    visibleSi: v.visible_si,
    defecto: v.defecto,
    definida: Boolean(cifrado),
    valor: v.es_secreto ? null : valor,
    enmascarado: v.es_secreto && valor ? enmascarar(valor) : null,
  };
}

export const grupoVista = (g, variables, extra) => ({
  grupo: g.grupo,
  nombre: g.nombre,
  descripcion: g.descripcion,
  ayuda: g.ayuda,
  permiteSucursal: g.nivel === 'ambos',
  selectorClave: g.selector_clave,
  modulo: g.modulo,
  ...extra,
  variables,
});