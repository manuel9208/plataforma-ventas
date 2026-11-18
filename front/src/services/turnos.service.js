import { apiFetch } from '../utils/apiFetch.js';

export const actual = () => apiFetch('/turnos/actual');
export const abrir = (fondoInicial) => apiFetch('/turnos/abrir', { metodo: 'POST', cuerpo: { fondoInicial } });
// datos = { efectivoContado, dejadoManana }. El administrador global cierra sin datos.
export const cerrar = (id, datos) => apiFetch(`/turnos/${id}/cerrar`, { metodo: 'POST', cuerpo: datos });
export const abiertos = () => apiFetch('/turnos/abiertos');