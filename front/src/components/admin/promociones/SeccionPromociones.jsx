import { useMemo, useState } from 'react';
import { textoError } from '../../../utils/textoError.js';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import TarjetaPromocion from './TarjetaPromocion.jsx';
import FormularioPromocion from './FormularioPromocion.jsx';
import ModalBajaPromocion from './ModalBajaPromocion.jsx';
import { usePromociones } from './usePromociones.js';

export default function SeccionPromociones() {
  const p = usePromociones();
  const [form, setForm] = useState(null); // { inicial: null (nueva) o la promoción a editar }
  const [abriendo, setAbriendo] = useState(null);
  const [baja, setBaja] = useState(null);
  const [aviso, setAviso] = useState('');

  const nombres = useMemo(() => new Map((p.opciones?.sucursales ?? []).map((s) => [s.id, s.nombre])), [p.opciones]);

  const editar = async (promo) => {
    setAbriendo(promo.id);
    setAviso('');
    try {
      setForm({ inicial: await p.obtener(promo.id) });
    } catch (e) {
      setAviso(textoError(e));
    } finally {
      setAbriendo(null);
    }
  };

  const encender = async (promo, valor) => {
    setAviso('');
    try {
      await p.encender(promo.id, valor);
    } catch (e) {
      setAviso(textoError(e));
    }
  };

  const mensaje = aviso || p.error;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-5">
        <Campo className="flex-1 max-w-xl" etiqueta="Buscar una promoción" value={p.buscar} onChange={(e) => p.setBuscar(e.target.value)} maxLength={60} />
        <Boton disabled={!p.opciones} onClick={() => setForm({ inicial: null })}>
          + Nueva promoción
        </Boton>
      </div>

      {mensaje && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={mensaje} />
        </div>
      )}

      {p.cargando && p.lista.length === 0 ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : p.lista.length === 0 && !p.error ? (
        <div className="max-w-xl rounded-3xl bg-white border border-[var(--c-borde)] p-6">
          <p className="text-lg font-semibold tracking-tight">{p.buscar ? 'No encontramos promociones' : 'Aún no tienes promociones'}</p>
          <p className="text-neutral-500 mt-2">
            {p.buscar ? 'Prueba con otra palabra.' : 'Crea un descuento, un happy hour o un combo para vender más.'}
          </p>
        </div>
      ) : (
        <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition ${p.cargando ? 'opacity-60' : ''}`}>
          {p.lista.map((promo) => (
            <TarjetaPromocion
              key={promo.id}
              promo={promo}
              nombres={nombres}
              abriendo={abriendo === promo.id}
              onEditar={() => editar(promo)}
              onEncender={(v) => encender(promo, v)}
              onBaja={() => setBaja(promo)}
            />
          ))}
        </ul>
      )}

      {p.hayMas && (
        <div className="mt-5">
          <Boton variante="secundario" cargando={p.cargando} onClick={p.verMas}>
            Ver más
          </Boton>
        </div>
      )}

      {form && p.opciones && (
        <FormularioPromocion
          key={form.inicial?.id ?? 'nueva'}
          inicial={form.inicial}
          opciones={p.opciones}
          onGuardar={p.guardar}
          onCerrar={() => setForm(null)}
        />
      )}

      {baja && <ModalBajaPromocion promocion={baja} onConfirmar={(motivo) => p.darDeBaja(baja.id, motivo)} onCerrar={() => setBaja(null)} />}
    </>
  );
}