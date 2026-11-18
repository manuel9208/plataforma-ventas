import { useEffect, useRef, useState } from 'react';
import * as svc from '../../services/caja.service.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { permiteDecimales } from '@plataforma/calculos';
import Boton from '../shared/Boton.jsx';
import Modal from '../shared/Modal.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import Icono from '../shared/Icono.jsx';
import { useCatalogoCaja } from './useCatalogoCaja.js';
import { useCatalogoServicios } from './useCatalogoServicios.js';
import { useCarrito } from './useCarrito.js';
import { usePromocionesCaja } from './usePromocionesCaja.js';
import CatalogoCaja from './CatalogoCaja.jsx';
import CatalogoServicios from './CatalogoServicios.jsx';
import Carrito from './Carrito.jsx';
import ModalCobro from './ModalCobro.jsx';
import ModalCantidad from './ModalCantidad.jsx';
import ModalArticulo from './ModalArticulo.jsx';
import ModalDescuento from './ModalDescuento.jsx';
import TicketVenta from './TicketVenta.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import { useAuth } from '../../context/AuthContext.jsx';

// pestana ('servicios' | 'productos') la elige la barra de Caja; en el súper siempre es productos
export default function PuntoDeVenta({ onVentaEnCurso, pestana = 'productos', config = null, errorConfig = '' }) {
  const { empresa } = useAuth();
  // Los servicios solo se piden si la sucursal los vende (Configuración); mientras carga, lo de siempre según el giro
  const vendeServicios = config ? config.vendeServicios : empresa.tipoNegocio === 'limpieza';

  const catalogo = useCatalogoCaja();
  const servicios = useCatalogoServicios(vendeServicios);
  const promos = usePromocionesCaja();
  const carrito = useCarrito(catalogo.incluyeIva, promos.promociones);

  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [pidiendo, setPidiendo] = useState(null); // cantidad de granel
  const [articulo, setArticulo] = useState(null); // { servicio, precio, edicion? }
  const [cobrando, setCobrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorCobro, setErrorCobro] = useState('');
  const [ticket, setTicket] = useState(null);
  const [descontando, setDescontando] = useState(null); // { clave, nombre } o { clave: null } (solo autorizar)
  const [panelAbierto, setPanelAbierto] = useState(false);
  // El id de la venta se genera una sola vez y se reutiliza si hay que reintentar
  const idVenta = useRef(nuevoUuid());

  const enCurso = !carrito.vacio || cobrando || enviando;
  useEffect(() => {
    onVentaEnCurso?.(enCurso);
  }, [enCurso, onVentaEnCurso]);

  const enServicios = vendeServicios && pestana === 'servicios';

  // Al cambiar entre Servicios y Productos se limpia el buscador
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setCodigo('');
    setAviso('');
    servicios.setBuscar('');
    catalogo.setBuscar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana]);

  // Lo que se escribe en el buscador filtra el catálogo de la pestaña activa
  const buscarEn = (texto) => {
    if (enServicios) servicios.setBuscar(texto);
    else catalogo.setBuscar(texto);
  };

  const agregarEscaneado = (p) => {
    const pr = p.presentaciones.find((x) => x.id === p.presentacionEscaneada) ?? p.presentaciones[0];
    if (permiteDecimales(pr.unidad)) setPidiendo({ producto: p, presentacion: pr });
    else carrito.agregar(p, pr, 1);
  };

  // El lector de códigos teclea el código y manda Enter (los códigos son de productos)
  const buscarCodigo = async (e) => {
    e.preventDefault();
    const c = codigo.trim();
    if (!c) {
      setAviso('Escribe o escanea un código y presiona Agregar. Para agregar a mano, toca el producto.');
      return;
    }
    setAviso('');
    if (enServicios) return; // en servicios el buscador solo filtra por nombre
    try {
      agregarEscaneado(await svc.escanear(c));
      setCodigo('');
    } catch {
      catalogo.setBuscar(c);
      setAviso(`"${c}" no es un código registrado. Se muestran los resultados por nombre.`);
    }
  };

  const cobrar = async ({ pagos, cliente }) => {
    setEnviando(true);
    setErrorCobro('');
    try {
      const venta = await svc.crearVenta({
        id: idVenta.current,
        lineas: carrito.lineas.map((l) => ({ presentacionId: l.presentacion.id, cantidad: l.cantidad })),
        servicios: carrito.notas.map((n) => ({
          servicioId: n.servicio.id,
          tipoArticuloId: n.precio.tipoArticuloId,
          ...(n.fechaPrometida ? { fechaPrometida: n.fechaPrometida } : {}),
          extraIds: n.extraIds,
          articulo: Object.fromEntries(Object.entries(n.articulo).filter(([, v]) => v !== '')),
        })),
        pagos,
        totalMostrado: carrito.totales.total,
        ...(carrito.descuentoManual ? { descuentos: carrito.descuentoManual } : {}),
        ...(cliente ?? {}),
      });
      setTicket(venta);
      setCobrando(false);
      setPanelAbierto(false);
      carrito.vaciar();
      idVenta.current = nuevoUuid();
    } catch (e) {
      if (/precios cambiaron/i.test(e.message)) {
        // Una promoción cambió: se piden de nuevo y se vuelve al carrito con el total correcto
        promos.recargar();
        setCobrando(false);
        setAviso(e.message);
      } else if (carrito.descuentoManual && /autoriz|encargado/i.test(e.message)) {
        carrito.limpiarAutorizacion();
        setCobrando(false);
        setAviso(e.message);
      } else {
        setErrorCobro(e.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  const nuevaVenta = () => {
    setTicket(null);
    setCodigo('');
    setAviso('');
    servicios.setBuscar('');
    catalogo.setBuscar('');
  };

  if (ticket) return <TicketVenta venta={ticket} onNueva={nuevaVenta} />;

  const panelCarrito = (
    <Carrito
      carrito={carrito}
      incluyeIva={catalogo.incluyeIva}
      onEditarArticulo={(n) => setArticulo({ servicio: n.servicio, precio: n.precio, edicion: n })}
      descuento={{ disponible: promos.descuentoManualMax > 0 }}
      onDescuento={setDescontando}
      onCobrar={() => {
        setErrorCobro('');
        setCobrando(true);
      }}
      onVaciar={carrito.vaciar}
    />
  );

  return (
    <>
      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:gap-6 items-start">
        <section>
          <form onSubmit={buscarCodigo} className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icono nombre="buscar" className="size-5" />
              </span>
              <input
                autoFocus
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  buscarEn(e.target.value);
                }}
                placeholder={enServicios ? 'Busca un servicio' : 'Escanea o busca por nombre'}
                className={`w-full min-h-12 pl-11 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20 ${
                  enServicios ? 'pr-4' : 'pr-14 sm:pr-4'
                }`}
              />
              {/* Celular: "Agregar" como botón "+" dentro del buscador */}
              {!enServicios && (
                <button
                  type="submit"
                  aria-label="Agregar"
                  className="sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 size-9 rounded-xl grid place-items-center text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]"
                >
                  <Icono nombre="mas" className="size-5" />
                </button>
              )}
            </div>
            {!enServicios && (
              <Boton type="submit" className="hidden sm:block">
                Agregar
              </Boton>
            )}
          </form>
          {aviso && <p className="mb-3 text-sm text-neutral-500">{aviso}</p>}
          {errorConfig && (
            <div className="mb-3">
              <MensajeError error={errorConfig} />
            </div>
          )}

          {enServicios ? (
            <CatalogoServicios catalogo={servicios} onElegir={(servicio, precio) => config && setArticulo({ servicio, precio })} />
          ) : (
            <CatalogoCaja catalogo={catalogo} onAgregar={carrito.agregar} />
          )}
        </section>

        <aside className="hidden lg:block sticky top-20 rounded-3xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 h-[calc(100dvh-7rem)]">
          {panelCarrito}
        </aside>
      </div>

      {/* Celular: barra inferior que abre el carrito */}
      {!carrito.vacio && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 p-3 bg-gradient-to-t from-[var(--c-fondo)] to-transparent">
          <button
            type="button"
            onClick={() => setPanelAbierto(true)}
            className="w-full min-h-14 px-5 rounded-2xl text-white flex items-center justify-between bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))] shadow-[0_12px_30px_-10px_rgba(29,43,79,0.8)]"
          >
            <span className="font-semibold">Ver {carrito.tieneServicios ? 'nota' : 'venta'} ({carrito.lineas.length + carrito.notas.length})</span>
            <span className="font-semibold">{formatearMoneda(carrito.totales.total, empresa.moneda)}</span>
          </button>
        </div>
      )}

      <Modal abierto={panelAbierto} titulo={carrito.tieneServicios ? 'Nota actual' : 'Venta actual'} onCerrar={() => setPanelAbierto(false)}>
        <div className="h-[60dvh]">{panelCarrito}</div>
      </Modal>

      {cobrando && config && (
        <ModalCobro
          total={carrito.totales.total}
          totalProductos={carrito.totalProductos}
          totalServicios={carrito.totalServicios}
          config={config}
          enviando={enviando}
          error={errorCobro}
          onConfirmar={cobrar}
          onCerrar={() => setCobrando(false)}
        />
      )}

      {articulo && config && (
        <ModalArticulo
          key={articulo.edicion?.clave ?? 'nuevo'}
          servicio={articulo.servicio}
          precio={articulo.precio}
          config={config}
          inicial={articulo.edicion}
          onAceptar={(datos) => {
            if (articulo.edicion) carrito.editarArticulo(articulo.edicion.clave, datos);
            else carrito.agregarArticulo(articulo.servicio, articulo.precio, datos);
            setArticulo(null);
          }}
          onCerrar={() => setArticulo(null)}
        />
      )}

      {descontando && promos.descuentoManualMax > 0 && (
        <ModalDescuento
          carrito={carrito}
          max={promos.descuentoManualMax}
          puedeAutorizar={promos.puedeAutorizar}
          objetivo={descontando}
          onCerrar={() => setDescontando(null)}
        />
      )}

      {pidiendo && (
        <ModalCantidad
          producto={pidiendo.producto}
          presentacion={pidiendo.presentacion}
          onAceptar={(cantidad) => {
            carrito.agregar(pidiendo.producto, pidiendo.presentacion, cantidad);
            setPidiendo(null);
            setCodigo('');
          }}
          onCerrar={() => setPidiendo(null)}
        />
      )}

      {catalogo.error && !catalogo.datos.length && !enServicios && (
        <div className="mt-4">
          <MensajeError error={catalogo.error} />
        </div>
      )}
    </>
  );
}