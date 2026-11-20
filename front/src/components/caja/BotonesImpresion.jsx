import { useEffect, useRef, useState } from 'react';
import { ticketsDeRecepcion } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatoTicket, imprimirDocumentos } from '../../utils/imprimirTicket.js';
import { leerConfigImpresora } from '../../utils/puenteImpresion.js';
import Boton from '../shared/Boton.jsx';
import { useImpresion } from './useImpresion.js';

const SEGUNDOS = 6;

// venta: ticket de recepción (nota o venta) · esCopia: sin PIN ni ticket del área
// armar({ impresion, empresa, fmt }) devuelve los documentos: sirve para imprimir otra cosa (ej. la entrega)
// automatico: imprime solo al aparecer (únicamente si esta computadora usa el programa de la caja)
// onTerminar: si se manda, tras imprimir bien cuenta unos segundos y la llama (ej. pasar a la nota nueva)
export default function BotonesImpresion({ venta = null, esCopia = false, armar = null, etiqueta = 'Imprimir', automatico = false, onTerminar = null }) {
  const { empresa } = useAuth();
  const impresion = useImpresion();
  const [aviso, setAviso] = useState('');
  const [impreso, setImpreso] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [restan, setRestan] = useState(null);
  const yaImprimio = useRef(false);
  const terminar = useRef(onTerminar);

  useEffect(() => {
    terminar.current = onTerminar;
  });

  const construir = () => {
    const fmt = formatoTicket(empresa.moneda);
    if (armar) return armar({ impresion, empresa, fmt });
    return ticketsDeRecepcion(venta, {
      ancho: impresion.anchoPapel,
      corte: impresion.corteAutomatico,
      abrirCajon: impresion.abrirCajon,
      imprimirArea: impresion.imprimirArea,
      empresa: empresa.nombre,
      esCopia,
      fmt,
    });
  };

  const imprimir = async () => {
    setAviso('');
    setImprimiendo(true);
    const r = await imprimirDocumentos(construir());
    if (r.aviso) setAviso(r.aviso);
    setImpreso(r.via === 'puente' && !r.aviso);
    setImprimiendo(false);
    return r;
  };

  // Impresión automática: una sola vez, cuando ya se conoce el ancho del papel de la caja
  useEffect(() => {
    if (!automatico || !impresion.cargada || yaImprimio.current) return;
    const cfg = leerConfigImpresora();
    if (cfg.via !== 'puente' || !cfg.autoImprimir) return;
    yaImprimio.current = true;
    imprimir().then((r) => {
      // Solo avanza solo si salió bien por el programa de la caja; si falló, se queda para no perder el PIN
      if (terminar.current && cfg.autoSiguiente && r.via === 'puente' && !r.aviso) setRestan(SEGUNDOS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico, impresion.cargada]);

  useEffect(() => {
    if (restan === null) return undefined;
    if (restan <= 0) {
      terminar.current?.();
      return undefined;
    }
    const t = setTimeout(() => setRestan((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [restan]);

  const conArea = Boolean(venta?.tieneServicios) && impresion.imprimirArea && !esCopia;

  return (
    <div className="space-y-2">
      {restan !== null && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span>Impreso. Nueva nota en {restan} s</span>
          <button type="button" onClick={() => setRestan(null)} className="font-semibold underline underline-offset-2">
            Quedarme aquí
          </button>
        </div>
      )}
      <Boton
        variante="secundario"
        className="w-full"
        cargando={imprimiendo}
        onClick={() => {
          setRestan(null);
          imprimir();
        }}
      >
        {etiqueta}
      </Boton>
      {impreso && restan === null && <p className="text-center text-xs text-emerald-700">Enviado a la impresora.</p>}
      {conArea && <p className="text-center text-xs text-neutral-400">Salen dos tickets: el del cliente y el del área de limpieza.</p>}
      {aviso && <p className="text-center text-xs text-amber-700">{aviso}</p>}
    </div>
  );
}