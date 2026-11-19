import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Segmentos from '../shared/Segmentos.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import BarraTurno from './BarraTurno.jsx';
import PuntoDeVenta from './PuntoDeVenta.jsx';
import NotasCaja from './NotasCaja.jsx';
import VentasCaja from './VentasCaja.jsx';
import GastosCaja from './GastosCaja.jsx';
import AvisoRetiro from './AvisoRetiro.jsx';
import { useMovimientos } from './useMovimientos.js';
import { useConfigNota } from './useConfigNota.js';
import ModalImpresoraEquipo from './ModalImpresoraEquipo.jsx';

const TIPOS = {
  servicios: { id: 'servicios', nombre: 'Servicios' },
  productos: { id: 'productos', nombre: 'Productos' },
};

// Todo lo que se ve con el turno abierto y vigente. Lo que se vende lo decide Configuración (por sucursal).
export default function CajaAbierta({ estado, onCerrar }) {
  const { empresa } = useAuth();
  const esLimpieza = empresa.tipoNegocio === 'limpieza';
  const { config, error: errorConfig } = useConfigNota();
  const mov = useMovimientos(true);

  const [ventaEnCurso, setVentaEnCurso] = useState(false);
  const [operando, setOperando] = useState(false); // cobro de saldo, entrega, devolución…
  const [modo, setModo] = useState('vender');
  const [tipoElegido, setTipoElegido] = useState(null);
  const [impresora, setImpresora] = useState(false);

  // Qué se vende y qué ve primero la caja (viene del servidor; mientras carga, lo de siempre según el giro)
  const vendeServicios = config ? config.vendeServicios : esLimpieza;
  const vendeProductos = config ? config.vendeProductos : true;
  const tipos = [vendeServicios && TIPOS.servicios, vendeProductos && TIPOS.productos].filter(Boolean);
  const porDefecto = config?.vistaInicial ?? (esLimpieza ? 'servicios' : 'productos');
  const tipoVenta = tipos.some((t) => t.id === tipoElegido) ? tipoElegido : tipos.some((t) => t.id === porDefecto) ? porDefecto : (tipos[0]?.id ?? 'productos');

  // Al terminar una venta, un cobro o una devolución se recalcula cuánto efectivo hay que retirar
  const ocupado = ventaEnCurso || operando;
  const estabaOcupado = useRef(false);
  const { recargar } = mov;
  useEffect(() => {
    if (estabaOcupado.current && !ocupado) recargar();
    estabaOcupado.current = ocupado;
  }, [ocupado, recargar]);

  // Para agregar una pestaña nueva: una línea aquí. Notas se queda en limpieza aunque se apague "vendo servicios":
  // las notas que ya están abiertas se siguen cobrando y entregando.
  const opciones = [
    { id: 'vender', nombre: 'Vender' },
    ...(esLimpieza ? [{ id: 'notas', nombre: 'Notas' }] : []),
    { id: 'ventas', nombre: 'Ventas' },
    { id: 'gastos', nombre: 'Gastos' },
  ];

  return (
    <>
      <BarraTurno key={estado.turno.id} estado={estado} bloqueado={ocupado} onCerrar={onCerrar} />
      <AvisoRetiro retiro={mov.retiro} onCrear={mov.crear} />

      {/* Si no caben en una línea (celular), las pestañas bajan a la siguiente: nada queda oculto */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <Segmentos compacto opciones={opciones} valor={modo} onCambio={setModo} />
        {modo === 'vender' && tipos.length > 1 && (
          <>
            <span className="hidden sm:block h-6 w-px shrink-0 bg-[var(--c-borde)]" aria-hidden="true" />
            <Segmentos compacto opciones={tipos} valor={tipoVenta} onCambio={setTipoElegido} />
          </>
        )}
        <button
          type="button"
          onClick={() => setImpresora(true)}
          className="ml-auto min-h-9 px-3 rounded-xl border border-[var(--c-borde)] bg-white text-sm font-medium text-neutral-600 hover:border-[var(--c-acento)]"
        >
          Impresora
        </button>
      </div>

      {errorConfig && (
        <div className="mb-3 max-w-xl">
          <MensajeError error={errorConfig} />
        </div>
      )}

      {/* Se queda montado (solo oculto) para no perder la venta en curso al cambiar de pestaña */}
      <div className={modo === 'vender' ? '' : 'hidden'}>
        <PuntoDeVenta onVentaEnCurso={setVentaEnCurso} pestana={tipoVenta} config={config} errorConfig={errorConfig} />
      </div>
      {modo === 'notas' && <NotasCaja onOperando={setOperando} />}
      {modo === 'ventas' && <VentasCaja onOperando={setOperando} />}
      {modo === 'gastos' && <GastosCaja mov={mov} />}
      {impresora && <ModalImpresoraEquipo onCerrar={() => setImpresora(false)} />}
    </>
  );
}