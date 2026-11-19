import { useState } from 'react';
import { CAMPOS_ARTICULO } from '@plataforma/calculos';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import { haceCuanto } from '../../utils/haceCuanto.js';
import Boton from '../shared/Boton.jsx';
import ModalMotivo from '../shared/ModalMotivo.jsx';
import { useArticulosCliente } from './useArticulosCliente.js';

const AL_INICIO = 4;

const tituloDe = (datos) =>
  CAMPOS_ARTICULO.filter(({ clave }) => clave !== 'descripcion')
    .map(({ clave }) => datos[clave])
    .filter(Boolean)
    .join(' · ') || 'Artículo';

// cliente: { id, nombre } · bloqueo: texto si no se puede agregar ahora · onAgregar(articulo)
export default function SusArticulos({ cliente, bloqueo = '', onAgregar }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const lista = useArticulosCliente(cliente.id);
  const [verTodos, setVerTodos] = useState(false);
  const [quitando, setQuitando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorBaja, setErrorBaja] = useState('');

  const quitar = async (motivo) => {
    setProcesando(true);
    setErrorBaja('');
    try {
      await lista.quitar(quitando.id, motivo);
      setQuitando(null);
    } catch (e) {
      setErrorBaja(e.message);
    } finally {
      setProcesando(false);
    }
  };

  if (lista.cargando) return <p className="mb-3 text-sm text-neutral-400">Buscando sus artículos…</p>;
  if (lista.error) {
    return <p className="mb-3 text-sm text-amber-700">No se pudieron cargar sus artículos. Puedes agregar servicios del catálogo.</p>;
  }
  if (!lista.datos.length) {
    return <p className="mb-3 text-sm text-neutral-500">Aún no tiene artículos guardados. Quedarán guardados al cobrar.</p>;
  }

  const mostrados = verTodos ? lista.datos : lista.datos.slice(0, AL_INICIO);

  return (
    <section className="mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold tracking-tight">Sus artículos</h3>
        <span className="text-xs text-neutral-400">{lista.datos.length}</span>
      </div>

      <ul className="grid sm:grid-cols-2 gap-3">
        {mostrados.map((a) => (
          <li key={a.id} className="rounded-2xl border border-[var(--c-borde)] bg-white p-4 flex flex-col">
            <p className="font-semibold">{tituloDe(a.datos)}</p>
            {a.datos.descripcion && <p className="text-xs text-neutral-500 italic mt-0.5">Última vez: {a.datos.descripcion}</p>}
            <p className="text-xs text-neutral-400 mt-0.5">
              {a.veces === 1 ? 'Vino 1 vez' : `Vino ${a.veces} veces`} · {haceCuanto(a.ultimaVez)}
            </p>

            <ul className="mt-3 space-y-1 flex-1">
              {a.servicios.map((s) => (
                <li key={`${s.servicioId}-${s.tipoArticuloId}`} className="flex justify-between gap-3 text-sm">
                  <span className={`min-w-0 truncate ${s.disponible === true ? '' : 'text-neutral-400 line-through'}`}>{s.nombre}</span>
                  <span className={`shrink-0 ${s.disponible === true ? 'font-medium' : 'text-xs text-amber-700'}`}>
                    {s.disponible === true ? dinero(s.precio.precio) : 'No disponible'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2">
              <Boton compacto className="flex-1" disabled={Boolean(bloqueo)} onClick={() => onAgregar(a)}>
                Agregar
              </Boton>
              <Boton
                compacto
                variante="secundario"
                onClick={() => {
                  setErrorBaja('');
                  setQuitando(a);
                }}
              >
                Quitar
              </Boton>
            </div>
          </li>
        ))}
      </ul>

      {bloqueo && <p className="mt-2 text-xs text-amber-700">{bloqueo}</p>}
      {lista.datos.length > AL_INICIO && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-3 text-sm font-medium text-[var(--c-primario)]">
          {verTodos ? 'Ver menos' : `Ver todos (${lista.datos.length})`}
        </button>
      )}

      {quitando && (
        <ModalMotivo
          titulo="Quitar de sus artículos"
          mensaje={`Se quitará "${tituloDe(quitando.datos)}" de la lista de ${cliente.nombre}. Sus notas anteriores no se tocan.`}
          textoConfirmar="Quitar"
          cargando={procesando}
          error={errorBaja}
          onConfirmar={quitar}
          onCancelar={() => setQuitando(null)}
        />
      )}
    </section>
  );
}