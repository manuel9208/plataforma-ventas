// Corte ciego: quien lo hace solo ve lo que entrega. Nunca el esperado ni la diferencia.
export const corteCiego = (conteo) => ({ vista: 'ciega', registrado: true, entregar: conteo.entregado });

// Corte detallado (gerente, administrador y AdminGlobal)
export const corteDetallado = (calculo, conteo, evaluacion) => ({
  vista: 'detallada',
  registrado: true,
  sinConteo: !conteo,
  ...calculo,
  contado: conteo?.contado ?? null,
  diferencia: evaluacion?.diferencia ?? null,
  resultado: evaluacion?.resultado ?? null,
  dejado: conteo?.dejado ?? null,
  entregado: conteo?.entregado ?? null,
});