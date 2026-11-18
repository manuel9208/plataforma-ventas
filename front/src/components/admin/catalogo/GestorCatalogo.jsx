import { useState } from 'react';
import { useCatalogo } from './useCatalogo.js';
import FormularioCatalogo from './FormularioCatalogo.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

// Lista con buscador, alta, edición y baja para cualquier catálogo sencillo.
// describir(item) -> { titulo, detalle, etiqueta }
export default function GestorCatalogo({
  entidad,
  textos,
  campos,
  describir,
  aviso,
  puedeCambiarEstado = () => true,
  accionesExtra,
}) {
  const h = useCatalogo(entidad);
  const [formulario, setFormulario] = useState(null); // null cerrado, {} nuevo, objeto editar
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  // Ejecuta una acción mostrando su error (si lo hay) arriba de la lista
  const ejecutar = async (fn) => {
    setErrorAccion('');
    try {
      await fn();
    } catch (e) {
      setErrorAccion(e.message);
    }
  };

  const guardar = (datos) => (formulario.id ? h.actualizar(formulario.id, datos) : h.crear(datos));

  const cambiarEstado = async () => {
    setProcesando(true);
    await ejecutar(() => h.actualizar(confirmar.id, { activo: !confirmar.activo }));
    setConfirmar(null);
    setProcesando(false);
  };

  const errorVisible = h.error || errorAccion;

  return (
    <>
      {aviso && (
        <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-neutral-200/70">{aviso}</p>
      )}

      <div className="flex gap-3 mb-4">
        <input
          value={h.buscar}
          onChange={(e) => h.setBuscar(e.target.value)}
          placeholder={textos.buscar}
          className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton onClick={() => setFormulario({})}>Nuevo</Boton>
      </div>

      {errorVisible && (
        <div className="mb-4">
          <MensajeError error={errorVisible} />
        </div>
      )}

      {h.cargando && h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">{textos.vacio}</p>
      ) : (
        <ul className="space-y-3">
          {h.datos.map((item) => {
            const d = describir(item);
            return (
              <li key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{d.titulo}</p>
                    {d.detalle && <p className="text-sm text-neutral-500 truncate">{d.detalle}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {d.etiqueta && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                        {d.etiqueta}
                      </span>
                    )}
                    <Insignia activo={item.activo} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Boton compacto variante="secundario" className="flex-1" onClick={() => setFormulario(item)}>
                    Editar
                  </Boton>
                  {accionesExtra?.(item, {
                    actualizar: (id, datos) => ejecutar(() => h.actualizar(id, datos)),
                  })}
                  {puedeCambiarEstado(item) && (
                    <Boton compacto variante="secundario" className="flex-1" onClick={() => setConfirmar(item)}>
                      {item.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {h.totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-5">
          <Boton compacto variante="secundario" disabled={h.pagina <= 1} onClick={() => h.setPagina(h.pagina - 1)}>
            Anterior
          </Boton>
          <span className="text-sm text-neutral-500">
            {h.pagina} de {h.totalPaginas}
          </span>
          <Boton
            compacto
            variante="secundario"
            disabled={h.pagina >= h.totalPaginas}
            onClick={() => h.setPagina(h.pagina + 1)}
          >
            Siguiente
          </Boton>
        </div>
      )}

      {formulario && (
        <FormularioCatalogo
          key={formulario.id ?? 'nuevo'}
          titulo={formulario.id ? textos.editar : textos.nuevo}
          campos={campos}
          item={formulario.id ? formulario : null}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar}
        titulo={confirmar?.activo ? 'Desactivar' : 'Activar'}
        mensaje={
          confirmar?.activo
            ? `"${confirmar?.nombre}" dejará de estar disponible para registros nuevos. Lo que ya lo usa no se afecta y podrás activarlo otra vez.`
            : `"${confirmar?.nombre}" volverá a estar disponible.`
        }
        textoConfirmar={confirmar?.activo ? 'Desactivar' : 'Activar'}
        peligro={!!confirmar?.activo}
        cargando={procesando}
        onConfirmar={cambiarEstado}
        onCancelar={() => setConfirmar(null)}
      />
    </>
  );
}