// Une el mensaje de un error de la API con sus detalles (campo: mensaje)
export const textoError = (err) => [err.message, ...(err.detalles || []).map((d) => `${d.campo}: ${d.mensaje}`)].join(' · ');