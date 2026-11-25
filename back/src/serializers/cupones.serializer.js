import { estadoCupon } from '@plataforma/calculos';

const num = (v) => (v === null || v === undefined ? null : Number(v));

// Lista y detalle son lo mismo
export function cupon(f, { zona, puedeEditar }) {
  const campos = {
    encendido: f.encendido,
    desde: f.desde,
    hasta: f.hasta,
    maxClientes: num(f.max_clientes),
    clientesUsados: Number(f.clientes_usados),
  };
  return {
    id: Number(f.id),
    nombre: f.nombre,
    codigo: f.codigo,
    modo: f.modo,
    valor: Number(f.valor),
    desde: f.desde,
    hasta: f.hasta,
    vecesPorCliente: Number(f.veces_por_cliente),
    maxClientes: campos.maxClientes,
    clienteId: f.cliente_id ?? null,
    cliente: f.cliente_id ? { nombre: f.cliente_nombre } : null,
    encendido: f.encendido,
    sucursalIds: (f.sucursal_ids ?? []).map(Number),
    usos: Number(f.usos),
    clientesUsados: campos.clientesUsados,
    creadoEn: f.creado_en,
    estado: estadoCupon(campos, { zona }),
    puedeEditar,
  };
}

// Lo que necesitan las funciones de shared/calculos/cupones.js
export const cuponParaCalculo = (f) => ({
  id: Number(f.id),
  nombre: f.nombre,
  codigo: f.codigo,
  modo: f.modo,
  valor: Number(f.valor),
  desde: f.desde,
  hasta: f.hasta,
  vecesPorCliente: Number(f.veces_por_cliente),
  maxClientes: num(f.max_clientes),
  clienteId: f.cliente_id ?? null,
  encendido: f.encendido,
  sucursalIds: (f.sucursal_ids ?? []).map(Number),
});