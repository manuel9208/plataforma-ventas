// Solo cajero (nivel 4) y auxiliar (nivel 5) salen por nombre en los tickets; administradores y gerentes no
const NIVEL_MINIMO_EN_TICKET = 4;
export const nombreParaTicket = (nombre, nivel) => (Number(nivel) >= NIVEL_MINIMO_EN_TICKET ? nombre : null);