// Ayudas para pedir el PIN de un encargado (entregas sin PIN, cancelaciones y reembolsos)
export const soloDigitos = (v, max) => String(v).replace(/\D/g, '').slice(0, max);

// ¿Ya se escribió lo necesario? Si quien está en caja tiene el permiso basta su PIN; si no, también el teléfono.
export const autorizacionLista = ({ pin, telefono }, puedeAutorizar) =>
  pin.length === 4 && (puedeAutorizar || telefono.length === 10);

// Lo que se manda al servidor
export const cuerpoAutorizacion = ({ pin, telefono }, puedeAutorizar) => ({
  pin,
  ...(puedeAutorizar ? {} : { telefono }),
});