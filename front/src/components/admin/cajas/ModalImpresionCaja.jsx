import { useState } from 'react';
import { ticketPrueba } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { imprimirDocumentos } from '../../../utils/imprimirTicket.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const ANCHOS = [
  { id: '58', nombre: '58 mm' },
  { id: '80', nombre: '80 mm' },
];

// caja: la caja a configurar · onGuardar(datos) guarda los cambios
export default function ModalImpresionCaja({ caja, onGuardar, onCerrar }) {
  const { empresa } = useAuth();
  const [ancho, setAncho] = useState(String(caja.anchoPapel));
  const [corte, setCorte] = useState(caja.corteAutomatico);
  const [cajon, setCajon] = useState(caja.abrirCajon);
  const [area, setArea] = useState(caja.imprimirArea);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ anchoPapel: Number(ancho), corteAutomatico: corte, abrirCajon: cajon, imprimirArea: area });
      onCerrar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const probar = () =>
    imprimirDocumentos([ticketPrueba({ ancho: Number(ancho), empresa: empresa.nombre, corte, abrirCajon: cajon })]);

  return (
    <Modal
      abierto
      titulo={`Impresión · ${caja.nombre}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" cargando={guardando} onClick={guardar}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">Ancho del papel</p>
          <Segmentos opciones={ANCHOS} valor={ancho} onCambio={setAncho} />
        </div>

        <div className="space-y-3">
          <Interruptor etiqueta="Cortar el papel al terminar" valor={corte} onCambiar={setCorte} />
          <Interruptor etiqueta="Abrir el cajón con pagos en efectivo" valor={cajon} onCambiar={setCajon} />
          {empresa.tipoNegocio === 'limpieza' && (
            <Interruptor
              etiqueta="Imprimir el ticket del área de limpieza"
              descripcion="Un ticket aparte, sin precios, con una casilla para marcar cada servicio."
              valor={area}
              onCambiar={setArea}
            />
          )}
        </div>

        <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-3">
          <p className="text-sm text-neutral-600">
            Imprime una prueba con el ancho elegido. En el cuadro de impresión escoge tu impresora de tickets, deja los márgenes en "Ninguno" y quita los encabezados.
          </p>
          <Boton compacto variante="secundario" onClick={probar}>
            Imprimir prueba
          </Boton>
          <p className="text-xs text-neutral-400">El corte y el cajón se activan cuando esté instalado el programa de impresión de la caja.</p>
        </div>

        <MensajeError error={error} />
      </div>
    </Modal>
  );
}