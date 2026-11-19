import { useState } from 'react';
import { ticketsDeRecepcion } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatoTicket, imprimirDocumentos } from '../../utils/imprimirTicket.js';
import Boton from '../shared/Boton.jsx';
import { useImpresion } from './useImpresion.js';

// Recién cobrada: imprime el ticket del cliente y el del área. Copia: solo el del cliente, marcado COPIA.
export default function BotonesImpresion({ venta, esCopia = false }) {
  const { empresa } = useAuth();
  const impresion = useImpresion();
  const [aviso, setAviso] = useState('');
  const [imprimiendo, setImprimiendo] = useState(false);

  const imprimir = async () => {
    setAviso('');
    setImprimiendo(true);
    const r = await imprimirDocumentos(
      ticketsDeRecepcion(venta, {
        ancho: impresion.anchoPapel,
        corte: impresion.corteAutomatico,
        abrirCajon: impresion.abrirCajon,
        imprimirArea: impresion.imprimirArea,
        empresa: empresa.nombre,
        esCopia,
        fmt: formatoTicket(empresa.moneda),
      })
    );
    if (r.aviso) setAviso(r.aviso);
    setImprimiendo(false);
  };

  const conArea = venta.tieneServicios && impresion.imprimirArea && !esCopia;

  return (
    <div className="space-y-1">
      <Boton variante="secundario" className="w-full" cargando={imprimiendo} onClick={imprimir}>
        Imprimir
      </Boton>
      {conArea && <p className="text-center text-xs text-neutral-400">Salen dos tickets: el del cliente y el del área de limpieza.</p>}
      {aviso && <p className="text-center text-xs text-amber-700">{aviso}</p>}
    </div>
  );
}