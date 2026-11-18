// Estados que todavía se pueden cancelar (el trabajo no está hecho)
export const PENDIENTE = ['recibido', 'en_proceso'];

const centavos = (v) => Math.round(Number(v) * 100);
const pesos = (c) => c / 100;

export const dosDecimales = (v) => pesos(centavos(v));

// Suma en centavos para no arrastrar decimales
export const sumar = (lista) => pesos(lista.reduce((s, v) => s + centavos(v), 0));

// Lo que se puede reembolsar: el servidor lo vuelve a calcular y es quien decide
export const topeReembolso = (valores, planReembolso) => {
  try {
    return planReembolso(valores, 0.01).tope;
  } catch {
    return 0;
  }
};