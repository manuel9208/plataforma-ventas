import { NOMBRES_MES_CUMPLE } from '@plataforma/calculos';

// { mes: 3, dia: 14 } -> "14 de marzo"
export const textoCumple = (c) => (c ? `${c.dia} de ${NOMBRES_MES_CUMPLE[c.mes - 1]}` : '');