import { useEffect, useState } from 'react';
import * as svc from '../../services/clientes.service.js';

// Artículos guardados de un cliente (el servidor ya trae precios y disponibilidad de hoy)
export function useArticulosCliente(clienteId) {
  const [estado, setEstado] = useState({ clienteId: null, datos: [], error: '' });

  useEffect(() => {
    if (!clienteId) return undefined;
    let vivo = true;
    svc
      .articulos(clienteId)
      .then((r) => vivo && setEstado({ clienteId, datos: r.datos, error: '' }))
      .catch((e) => vivo && setEstado({ clienteId, datos: [], error: e.message }));
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  // Si cambió el cliente, lo que hay en memoria es del anterior
  const actual = estado.clienteId === clienteId;

  return {
    datos: actual ? estado.datos : [],
    error: actual ? estado.error : '',
    cargando: Boolean(clienteId) && !actual,
    quitar: async (articuloId, motivo) => {
      await svc.bajaArticulo(clienteId, articuloId, motivo);
      setEstado((e) => ({ ...e, datos: e.datos.filter((x) => x.id !== articuloId) }));
    },
  };
}