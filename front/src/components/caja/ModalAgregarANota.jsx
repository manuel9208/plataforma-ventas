import { useEffect, useRef, useState } from 'react';
import * as svc from '../../services/caja.service.js';
import * as notasSvc from '../../services/notas.service.js';
import { nuevoUuid } from '../../utils/uuid.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Icono from '../shared/Icono.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import Segmentos from '../shared/Segmentos.jsx';
import { useCatalogoCaja } from './useCatalogoCaja.js';
import { useCatalogoServicios } from './useCatalogoServicios.js';
import { useCarrito } from './useCarrito.js';
import { usePromocionesCaja } from './usePromocionesCaja.js';
import CatalogoCaja from './CatalogoCaja.jsx';
import CatalogoServicios from './CatalogoServicios.jsx';
import Carrito from './Carrito.jsx';
import ModalArticulo from './ModalArticulo.jsx';
import ModalOtroServicio from './ModalOtroServicio.jsx';

// Agrega productos y servicios a una nota abierta. No pide abono: lo agregado se suma al saldo.
// El servidor vuelve a calcular todo (precios, promociones, IVA).
export default function ModalAgregarANota({ nota, onListo, onCerrar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  const [config, setConfig] = useState(null);
  const [errorConfig, setErrorConfig] = useState('');
  useEffect(() => {
    let vivo = true;
    svc
      .configuracion()
      .then((c) => vivo && setConfig(c))
      .catch((e) => vivo && setErrorConfig(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const vendeServicios = config ? config.vendeServicios : empresa.tipoNegocio === 'limpieza';
  const vendeProductos = config ? config.vendeProductos : true;

  const catalogo = useCatalogoCaja();
  const servicios = useCatalogoServicios(vendeServicios);
  const promos = usePromocionesCaja();
  // La nota conserva su criterio de IVA y su financiamiento: los servicios nuevos lo heredan
  const carrito = useCarrito(nota.preciosIncluyenIva, promos.promociones, {
    disponible: nota.financiada === true,
    cargo: config?.financiamientoCargo ?? 0,
  });
  const { ponerFinanciada } = carrito;
  useEffect(() => {
    if (nota.financiada) ponerFinanciada(true);
  }, [nota.financiada, ponerFinanciada]);

  const opciones = [
    vendeServicios && { id: 'servicios', nombre: 'Servicios' },
    vendeProductos && { id: 'productos', nombre: 'Productos' },
  ].filter(Boolean);
  const [pestana, setPestana] = useState('servicios');
  const activa = opciones.some((o) => o.id === pestana) ? pestana : opciones[0]?.id;

  const [codigo, setCodigo] = useState('');
  const [editor, setEditor] = useState(null);
  const [otro, setOtro] = useState(null);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // El id se reutiliza si hay que reintentar: así nunca se agrega dos veces
  const idOperacion = useRef(nuevoUuid());

  const cambiarPestana = (p) => {
    setPestana(p);
    setCodigo('');
    servicios.setBuscar('');
    catalogo.setBuscar('');
  };

  const buscar = (texto) => {
    setCodigo(texto);
    if (activa === 'servicios') servicios.setBuscar(texto);
    else catalogo.setBuscar(texto);
  };

  const agregar = async () => {
    if (carrito.vacio || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const r = await notasSvc.adicionar(nota.id, {
        id: idOperacion.current,
        lineas: carrito.lineas.map((l) => ({ presentacionId: l.presentacion.id, cantidad: l.cantidad })),
        articulos: carrito.articulosEnvio,
        totalMostrado: carrito.totales.total,
      });
      onListo(r);
    } catch (e) {
      if (/precios cambiaron/i.test(e.message)) promos.recargar();
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <>
      <Modal
        abierto
        ancho="sm:max-w-5xl"
        titulo={`Agregar a la nota ${nota.folio}`}
        onCerrar={enviando ? () => {} : onCerrar}
        pie={
          <>
            <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton className="flex-1" disabled={carrito.vacio || !config} cargando={enviando} onClick={agregar}>
              {carrito.vacio ? 'Agregar a la nota' : `Agregar ${dinero(carrito.totales.total)}`}
            </Boton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Lo que agregues se suma al saldo de la nota y se cobra después con “Cobrar saldo”.
            {nota.financiada ? ' La nota es financiada: los servicios nuevos llevan el cargo.' : ''}
          </p>

          {errorConfig && <MensajeError error={errorConfig} />}
          {aviso && <p className="text-sm text-neutral-500">{aviso}</p>}

          <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-5 items-start space-y-4 lg:space-y-0">
            <section className="space-y-3 min-w-0">
              {opciones.length > 1 && <Segmentos opciones={opciones} valor={activa} onCambio={cambiarPestana} />}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                  <Icono nombre="buscar" className="size-5" />
                </span>
                <input
                  value={codigo}
                  onChange={(e) => buscar(e.target.value)}
                  placeholder={activa === 'servicios' ? 'Busca un servicio' : 'Busca un producto por nombre'}
                  className="w-full min-h-12 pl-11 pr-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
                />
              </div>

              {activa === 'servicios' ? (
                <CatalogoServicios
                  catalogo={servicios}
                  onElegir={(servicio, precio) => {
                    if (!config) return;
                    setAviso('');
                    setEditor({ modo: 'completo', servicio, precio });
                  }}
                />
              ) : (
                <CatalogoCaja catalogo={catalogo} onAgregar={carrito.agregar} />
              )}
            </section>

            <aside className="rounded-3xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 h-[60dvh] lg:sticky lg:top-0">
              <Carrito
                adicion
                carrito={carrito}
                incluyeIva={nota.preciosIncluyenIva}
                descuento={{ disponible: false }}
                onDescuento={() => {}}
                onCliente={() => {}}
                onEditarDatos={(g) => setEditor({ modo: 'datos', grupo: g })}
                onEditarServicio={(g, s) => setEditor({ modo: 'servicio', servicio: s.servicio, precio: s.precio, grupo: g, servicioEdit: s })}
                onOtroServicio={setOtro}
                onCobrar={agregar}
                onVaciar={carrito.vaciar}
              />
            </aside>
          </div>

          <MensajeError error={error} />
        </div>
      </Modal>

      {editor && config && (
        <ModalArticulo
          key={`${editor.modo}-${editor.servicioEdit?.clave ?? editor.grupo?.clave ?? 'nuevo'}`}
          modo={editor.modo}
          servicio={editor.servicio}
          precio={editor.precio}
          config={config}
          inicialDatos={editor.grupo ? { datos: editor.grupo.datos, comentario: editor.grupo.comentario } : undefined}
          inicialServicio={editor.servicioEdit}
          onAceptar={(d) => {
            const s = { servicio: editor.servicio, precio: editor.precio, extraIds: d.extraIds, fechaPrometida: d.fechaPrometida, fechaMostrada: d.fechaMostrada };
            if (editor.modo === 'completo') carrito.agregarArticulo({ datos: d.datos, comentario: d.comentario }, s);
            else if (editor.modo === 'datos') carrito.editarDatos(editor.grupo.clave, { datos: d.datos, comentario: d.comentario });
            else if (editor.servicioEdit) carrito.editarServicio(editor.servicioEdit.clave, s);
            else carrito.agregarServicio(editor.grupo.clave, s);
            setEditor(null);
          }}
          onCerrar={() => setEditor(null)}
        />
      )}

      {otro && (
        <ModalOtroServicio
          catalogo={servicios}
          tipoArticuloId={otro.servicios[0].precio.tipoArticuloId}
          tipoNombre={otro.servicios[0].precio.tipo}
          onElegir={(servicio, precio) => {
            setEditor({ modo: 'servicio', servicio, precio, grupo: otro });
            setOtro(null);
            servicios.setBuscar('');
          }}
          onCerrar={() => {
            setOtro(null);
            servicios.setBuscar('');
          }}
        />
      )}
    </>
  );
}