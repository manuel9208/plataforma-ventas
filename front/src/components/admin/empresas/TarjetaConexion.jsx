import { useState } from 'react';
import Boton from '../../shared/Boton.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import Insignia from '../../shared/Insignia.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import CampoConexion from './CampoConexion.jsx';

// Un servicio (WhatsApp, correo…). En una sucursal puede usar la configuración de la empresa o tener la suya.
export default function TarjetaConexion({ g, enSucursal, onGuardar, onQuitar, onRevelar }) {
  const [borrador, setBorrador] = useState({});
  const [propia, setPropia] = useState(g.propia);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const soloLectura = enSucursal && !propia;
  const nuevaPropia = enSucursal && propia && !g.propia;

  const poner = (clave, valor) =>
    setBorrador((b) => {
      const n = { ...b };
      if (valor === undefined) delete n[clave];
      else n[clave] = valor;
      return n;
    });

  // Si el servicio tiene selector (proveedor), solo se muestran los campos de ese proveedor
  const selector = g.variables.find((v) => v.clave === g.selectorClave);
  const elegido = selector ? borrador[selector.clave] ?? selector.valor ?? selector.defecto : null;
  const visibles = g.variables.filter((v) => !v.visibleSi || v.visibleSi === elegido);

  const hayCambios = Object.keys(borrador).length > 0 || nuevaPropia;

  const guardar = async () => {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    setError('');
    try {
      // El selector siempre va completo, para que el proveedor quede guardado
      const valores = { ...borrador };
      if (selector) valores[selector.clave] = elegido;
      await onGuardar(g.grupo, valores);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPropia = (valor) => {
    setError('');
    if (valor) {
      setPropia(true);
      setBorrador({});
    } else if (g.propia) {
      setConfirmarQuitar(true);
    } else {
      setPropia(false);
      setBorrador({});
    }
  };

  const quitar = async () => {
    setProcesando(true);
    try {
      await onQuitar(g.grupo);
    } catch (e) {
      setError(e.message);
      setConfirmarQuitar(false);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <li className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight">{g.nombre}</p>
          <p className="text-sm text-neutral-500">{g.descripcion}</p>
        </div>
        {enSucursal && <Insignia activo={propia} textoActivo="Propia" textoInactivo="De la empresa" />}
      </div>

      {!g.moduloActivo && (
        <p className="mt-3 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
          El módulo de este servicio está apagado en esta empresa: las llaves se guardan, pero no funcionará hasta que lo enciendas en Módulos.
        </p>
      )}
      {g.ayuda && <p className="mt-3 text-xs text-neutral-500">{g.ayuda}</p>}

      {enSucursal && (
        <div className="mt-4">
          <Interruptor
            etiqueta="Esta sucursal tiene su propia configuración"
            descripcion={propia ? 'Escribe todos los datos de esta sucursal.' : 'Usa la configuración de la empresa.'}
            valor={propia}
            onCambiar={cambiarPropia}
          />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {visibles.length === 0 ? (
          <p className="text-sm text-neutral-500">Este proveedor no necesita llaves.</p>
        ) : (
          visibles.map((v) => (
            <CampoConexion
              key={v.clave}
              v={v}
              borrador={borrador[v.clave]}
              onCambio={(x) => poner(v.clave, x)}
              soloLectura={soloLectura}
              puedeRevelar={!g.heredada}
              onRevelar={onRevelar}
            />
          ))
        )}
      </div>

      {error && (
        <div className="mt-3">
          <MensajeError error={error} />
        </div>
      )}

      {!soloLectura && (
        <div className="mt-4 pt-4 border-t border-[var(--c-borde)] mt-auto">
          <Boton className="w-full" compacto disabled={!hayCambios} cargando={guardando} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      )}

      <ConfirmModal
        abierto={confirmarQuitar}
        titulo="Usar la configuración de la empresa"
        mensaje="Se borran las llaves propias de esta sucursal y vuelve a usar las de la empresa."
        textoConfirmar="Quitar las propias"
        peligro
        cargando={procesando}
        onConfirmar={quitar}
        onCancelar={() => setConfirmarQuitar(false)}
      />
    </li>
  );
}