import { useEffect, useRef, useState } from 'react';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Segmentos from '../../shared/Segmentos.jsx';

const SEGUNDOS = 30;

// borrador: undefined = sin cambios · texto = nuevo valor · "" = quitar. onCambio(undefined) deshace.
export default function CampoConexion({ v, borrador, onCambio, soloLectura, puedeRevelar, onRevelar }) {
  const [rev, setRev] = useState(null); // { valor, restante }
  const [errorRev, setErrorRev] = useState('');
  const [cargandoRev, setCargandoRev] = useState(false);
  const reloj = useRef(null);

  useEffect(() => () => clearInterval(reloj.current), []);

  const ocultar = () => {
    clearInterval(reloj.current);
    setRev(null);
  };

  const revelar = async () => {
    setCargandoRev(true);
    setErrorRev('');
    try {
      const valor = await onRevelar(v.clave);
      clearInterval(reloj.current);
      setRev({ valor, restante: SEGUNDOS });
      reloj.current = setInterval(() => {
        setRev((r) => {
          if (!r) return r;
          if (r.restante <= 1) {
            clearInterval(reloj.current);
            return null;
          }
          return { ...r, restante: r.restante - 1 };
        });
      }, 1000);
    } catch (e) {
      setErrorRev(e.message);
    } finally {
      setCargandoRev(false);
    }
  };

  // Selector de opciones (por ejemplo el proveedor de WhatsApp)
  if (v.tipo === 'opcion') {
    const actual = borrador ?? v.valor ?? v.defecto;
    const etiqueta = v.opciones.find((o) => o.valor === actual)?.etiqueta ?? actual;
    return (
      <div>
        <p className="text-sm font-medium text-neutral-600 mb-1.5">{v.etiqueta}</p>
        {soloLectura ? (
          <p className="min-h-12 flex items-center px-4 rounded-xl bg-neutral-100 text-neutral-600">{etiqueta}</p>
        ) : (
          <Segmentos opciones={v.opciones.map((o) => ({ id: o.valor, nombre: o.etiqueta }))} valor={actual} onCambio={(x) => onCambio(x)} />
        )}
      </div>
    );
  }

  // Llave secreta: se ve enmascarada; para cambiarla se escribe una nueva
  if (v.esSecreto) {
    const quitando = borrador === '';
    return (
      <div>
        <Campo
          etiqueta={v.etiqueta}
          type="password"
          autoComplete="off"
          disabled={soloLectura || quitando}
          value={quitando ? '' : borrador ?? ''}
          placeholder={quitando ? 'Se quitará al guardar' : v.enmascarado ?? 'Sin configurar'}
          onChange={(e) => onCambio(e.target.value === '' ? undefined : e.target.value)}
          ayuda={v.definida && !soloLectura && !quitando ? 'Déjalo vacío para conservar la actual.' : undefined}
        />
        {!soloLectura && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {v.definida && !quitando && puedeRevelar && !rev && (
              <Boton compacto variante="secundario" cargando={cargandoRev} onClick={revelar}>
                Revelar
              </Boton>
            )}
            {v.definida && !quitando && (
              <button type="button" onClick={() => onCambio('')} className="min-h-10 px-2 text-sm text-neutral-500 hover:text-red-700">
                Quitar
              </button>
            )}
            {quitando && (
              <button type="button" onClick={() => onCambio(undefined)} className="min-h-10 px-2 text-sm font-medium text-[var(--c-primario-2)] underline underline-offset-4">
                Deshacer
              </button>
            )}
          </div>
        )}
        {rev && (
          <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
            <p className="font-mono break-all text-neutral-900">{rev.valor}</p>
            <p className="text-xs text-amber-800 mt-1">
              Se oculta en {rev.restante} s ·{' '}
              <button type="button" onClick={ocultar} className="underline underline-offset-2">
                Ocultar ya
              </button>
            </p>
          </div>
        )}
        {errorRev && <p className="mt-2 text-xs text-red-600">{errorRev}</p>}
      </div>
    );
  }

  // Dato normal (se ve completo)
  const original = v.valor ?? '';
  return (
    <Campo
      etiqueta={v.etiqueta}
      type={v.tipo === 'numero' ? 'number' : 'text'}
      inputMode={v.tipo === 'numero' ? 'numeric' : undefined}
      autoComplete="off"
      disabled={soloLectura}
      value={borrador ?? original}
      placeholder={v.descripcion}
      onChange={(e) => onCambio(e.target.value === original ? undefined : e.target.value)}
    />
  );
}