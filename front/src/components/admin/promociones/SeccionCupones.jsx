import { useMemo, useState } from 'react';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import TarjetaCupon from './TarjetaCupon.jsx';
import FormularioCupon from './FormularioCupon.jsx';
import ModalBajaCupon from './ModalBajaCupon.jsx';
import { useCupones } from './useCupones.js';
import { textoError } from '../../../utils/textoError.js';

export default function SeccionCupones() {
  const c = useCupones();
  const [form, setForm] = useState(null); // { inicial: null (nuevo) o el cupón a editar }
  const [baja, setBaja] = useState(null);
  const [aviso, setAviso] = useState('');

  const nombres = useMemo(() => new Map((c.opciones?.sucursales ?? []).map((s) => [s.id, s.nombre])), [c.opciones]);

  const encender = async (cupon, valor) => {
    setAviso('');
    try {
      await c.encender(cupon.id, valor);
    } catch (e) {
      setAviso(textoError(e));
    }
  };

  const mensaje = aviso || c.error;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-5">
        <Campo className="flex-1 max-w-xl" etiqueta="Buscar un cupón (nombre o código)" value={c.buscar} onChange={(e) => c.setBuscar(e.target.value)} maxLength={60} />
        <Boton disabled={!c.opciones} onClick={() => setForm({ inicial: null })}>
          + Nuevo cupón
        </Boton>
      </div>

      {mensaje && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={mensaje} />
        </div>
      )}

      {c.cargando && c.lista.length === 0 ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : c.lista.length === 0 && !c.error ? (
        <div className="max-w-xl rounded-3xl bg-white border border-[var(--c-borde)] p-6">
          <p className="text-lg font-semibold tracking-tight">{c.buscar ? 'No encontramos cupones' : 'Aún no tienes cupones'}</p>
          <p className="text-neutral-500 mt-2">
            {c.buscar ? 'Prueba con otra palabra.' : 'Crea un cupón con un código para regalar descuentos a tus clientes.'}
          </p>
        </div>
      ) : (
        <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition ${c.cargando ? 'opacity-60' : ''}`}>
          {c.lista.map((cupon) => (
            <TarjetaCupon
              key={cupon.id}
              cupon={cupon}
              nombres={nombres}
              onEditar={() => setForm({ inicial: cupon })}
              onEncender={(v) => encender(cupon, v)}
              onBaja={() => setBaja(cupon)}
            />
          ))}
        </ul>
      )}

      {c.hayMas && (
        <div className="mt-5">
          <Boton variante="secundario" cargando={c.cargando} onClick={c.verMas}>
            Ver más
          </Boton>
        </div>
      )}

      {form && c.opciones && (
        <FormularioCupon key={form.inicial?.id ?? 'nuevo'} inicial={form.inicial} opciones={c.opciones} onGuardar={c.guardar} onCerrar={() => setForm(null)} />
      )}

      {baja && <ModalBajaCupon cupon={baja} onConfirmar={(motivo) => c.darDeBaja(baja.id, motivo)} onCerrar={() => setBaja(null)} />}
    </>
  );
}