import { useEffect, useState } from 'react';
import { ticketPrueba } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { imprimirDocumentos } from '../../utils/imprimirTicket.js';
import { comandoInstalacion, estadoPuente, guardarConfigImpresora, leerConfigImpresora } from '../../utils/puenteImpresion.js';
import Modal from '../shared/Modal.jsx';
import Boton from '../shared/Boton.jsx';
import Campo from '../shared/Campo.jsx';
import Segmentos from '../shared/Segmentos.jsx';
import Plegable from '../shared/Plegable.jsx';
import Interruptor from '../shared/Interruptor.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import { useImpresion } from './useImpresion.js';

const VIAS = [
  { id: 'navegador', nombre: 'Navegador' },
  { id: 'puente', nombre: 'Programa de la caja' },
];
const CONEXIONES = [
  { id: 'usb', nombre: 'USB' },
  { id: 'ip', nombre: 'Red (IP)' },
];
const IP = /^\d{1,3}(\.\d{1,3}){3}$/;

// Cómo imprime ESTA computadora (se guarda en el navegador de este equipo)
export default function ModalImpresoraEquipo({ onCerrar }) {
  const { empresa } = useAuth();
  const impresion = useImpresion();
  const [cfg, setCfg] = useState(leerConfigImpresora);
  const [puente, setPuente] = useState({ estado: 'revisando' });
  const [revision, setRevision] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    if (cfg.via !== 'puente') return undefined;
    let vivo = true;
    estadoPuente().then((r) => vivo && setPuente(r.activo ? { estado: 'activo', ...r } : { estado: 'apagado' }));
    return () => {
      vivo = false;
    };
  }, [cfg.via, revision]);

  const comando = comandoInstalacion();
  const d = cfg.destino;
  const problema =
    cfg.via !== 'puente'
      ? ''
      : d.tipo === 'usb'
        ? d.nombre
          ? ''
          : 'Elige la impresora.'
        : IP.test(d.host ?? '')
          ? ''
          : 'Escribe la dirección IP de la impresora.';

  const cambiarDestino = (parcial) => setCfg((c) => ({ ...c, destino: { ...c.destino, ...parcial } }));
  const cambiarConexion = (tipo) => setCfg((c) => ({ ...c, destino: tipo === 'usb' ? { tipo, nombre: '' } : { tipo, host: '', puerto: 9100 } }));

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comando);
      setCopiado(true);
    } catch {
      setError('No se pudo copiar. Selecciona el texto de la caja y cópialo.');
    }
  };

  const probar = async () => {
    if (problema) return setError(problema);
    setError('');
    setMensaje('');
    setProbando(true);
    guardarConfigImpresora(cfg);
    const r = await imprimirDocumentos([
      ticketPrueba({ ancho: impresion.anchoPapel, empresa: empresa.nombre, corte: impresion.corteAutomatico, abrirCajon: impresion.abrirCajon }),
    ]);
    setMensaje(
      r.aviso ?? (r.via === 'puente' ? 'Enviado a la impresora. Revisa que haya salido bien (si tu caja abre cajón, debe abrirse).' : 'Se abrió la impresión del navegador.')
    );
    setProbando(false);
  };

  const guardar = () => {
    if (problema) return setError(problema);
    guardarConfigImpresora(cfg);
    onCerrar();
  };

  const impresoras = puente.impresoras ?? [];
  const lista = d.nombre && !impresoras.some((i) => i.nombre === d.nombre) ? [{ nombre: d.nombre }, ...impresoras] : impresoras;

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Impresora de esta computadora"
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" onClick={guardar}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">¿Cómo imprime esta computadora?</p>
          <Segmentos opciones={VIAS} valor={cfg.via} onCambio={(via) => setCfg((c) => ({ ...c, via }))} />
          <p className="mt-2 text-xs text-neutral-500">
            {cfg.via === 'puente'
              ? 'Imprime directo en la impresora de tickets, corta el papel y abre el cajón.'
              : 'Abre el cuadro de impresión del navegador. No corta el papel ni abre el cajón.'}
          </p>
        </div>

        {cfg.via === 'puente' && (
          <>
            {puente.estado === 'revisando' && <p className="text-sm text-neutral-400">Buscando el programa de impresión…</p>}

            {puente.estado === 'activo' && (
              <p className="rounded-xl bg-emerald-50 text-emerald-800 text-sm font-medium px-4 py-3">Programa conectado · versión {puente.version}</p>
            )}

            {puente.estado === 'apagado' && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 space-y-3 text-sm">
                <p className="font-medium text-amber-800">No encuentro el programa en esta computadora.</p>
                <ol className="list-decimal pl-5 space-y-1 text-neutral-700">
                  <li>Abre el menú Inicio, escribe PowerShell y ábrelo (normal, no como administrador).</li>
                  <li>Copia el comando de abajo y pégalo en esa ventana (clic derecho).</li>
                  <li>Presiona Enter y espera el mensaje "Listo".</li>
                  <li>Vuelve aquí y toca "Revisar de nuevo". Si el navegador pregunta por acceso a la red local, elige Permitir.</li>
                </ol>
                <textarea
                  readOnly
                  rows={4}
                  value={comando}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-xl border border-[var(--c-borde)] bg-white p-3 text-xs font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <Boton compacto variante="secundario" onClick={copiar}>
                    {copiado ? 'Copiado' : 'Copiar comando'}
                  </Boton>
                  <Boton
                    compacto
                    variante="secundario"
                    onClick={() => {
                      setPuente({ estado: 'revisando' });
                      setRevision((n) => n + 1);
                    }}
                  >
                    Revisar de nuevo
                  </Boton>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Conexión de la impresora</p>
              <Segmentos opciones={CONEXIONES} valor={d.tipo} onCambio={cambiarConexion} />
            </div>

            {d.tipo === 'usb' ? (
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-2" htmlFor="impresora-windows">
                  Impresora de Windows
                </label>
                <select
                  id="impresora-windows"
                  value={d.nombre}
                  onChange={(e) => cambiarDestino({ nombre: e.target.value })}
                  className="w-full min-h-11 px-3 rounded-xl bg-white border border-[var(--c-borde)] text-sm outline-none"
                >
                  <option value="">Elige una…</option>
                  {lista.map((i) => (
                    <option key={i.nombre} value={i.nombre}>
                      {i.nombre}
                    </option>
                  ))}
                </select>
                {puente.estado === 'activo' && impresoras.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">Windows no tiene impresoras instaladas. Instala la de tickets primero.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Dirección IP" placeholder="192.168.1.50" value={d.host ?? ''} onChange={(e) => cambiarDestino({ host: e.target.value.trim() })} />
                <Campo
                  etiqueta="Puerto"
                  type="number"
                  inputMode="numeric"
                  value={d.puerto ?? 9100}
                  onChange={(e) => cambiarDestino({ puerto: Number(e.target.value) })}
                />
              </div>
            )}
          </>
        )}

        {cfg.via === 'puente' && (
          <div className="space-y-3">
            <Interruptor
              etiqueta="Imprimir solo al cobrar y al entregar"
              descripcion="Sale el ticket sin tocar Imprimir. El botón sigue ahí por si hace falta repetirlo."
              valor={cfg.autoImprimir}
              onCambiar={(autoImprimir) => setCfg((c) => ({ ...c, autoImprimir }))}
            />
            {cfg.autoImprimir && (
              <Interruptor
                etiqueta="Pasar a la siguiente nota al terminar"
                descripcion="Después de imprimir un cobro, la pantalla se queda unos segundos y pasa sola a la nota nueva."
                valor={cfg.autoSiguiente}
                onCambiar={(autoSiguiente) => setCfg((c) => ({ ...c, autoSiguiente }))}
              />
            )}
          </div>
        )}

        <Plegable titulo="Opciones avanzadas" abiertaInicial={false}>
          <Interruptor
            etiqueta="Imprimir acentos y la letra ñ"
            descripcion="Apágalo solo si en la prueba salen símbolos raros en lugar de acentos."
            valor={cfg.acentos}
            onCambiar={(acentos) => setCfg((c) => ({ ...c, acentos }))}
          />
        </Plegable>

        <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 space-y-3">
          <p className="text-sm text-neutral-600">
            Imprime una prueba con el papel de {impresion.anchoPapel} mm de tu caja. Revisa que la regla de números salga completa, que los acentos se vean bien y que
            {impresion.corteAutomatico ? ' corte el papel' : ' avance el papel'}
            {impresion.abrirCajon ? ' y abra el cajón.' : '.'}
          </p>
          <Boton compacto variante="secundario" cargando={probando} onClick={probar}>
            Imprimir prueba
          </Boton>
          {mensaje && <p className="text-sm text-neutral-700">{mensaje}</p>}
        </div>

        <MensajeError error={error} />
      </div>
    </Modal>
  );
}