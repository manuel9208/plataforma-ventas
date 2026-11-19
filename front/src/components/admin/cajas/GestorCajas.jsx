import { useState } from 'react';
import { useCajas } from './useCajas.js';
import FormularioCaja from './FormularioCaja.jsx';
import ModalImpresionCaja from './ModalImpresionCaja.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

export default function GestorCajas() {
  const h = useCajas();
  const [formulario, setFormulario] = useState(null); // null cerrado, {} nueva, objeto = caja a editar
  const [confirmar, setConfirmar] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const cambiarEstado = async () => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await h.actualizar(confirmar.id, { activo: !confirmar.activo });
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setConfirmar(null);
      setProcesando(false);
    }
  };

  const guardar = (datos) => (formulario.id ? h.actualizar(formulario.id, datos) : h.crear(datos));

  return (
    <>
      <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-[var(--c-borde)]">
        Cada sucursal puede tener varias cajas trabajando a la vez. Cada caja solo puede tener un turno abierto, y cada empleado usa la caja que le asignes en "Quién usa cada caja".
      </p>

      <div className="flex justify-end mb-4">
        <Boton onClick={() => setFormulario({})} disabled={h.sucursales.length === 0}>
          Nueva caja
        </Boton>
      </div>

      {(h.error || errorAccion) && (
        <div className="mb-4">
          <MensajeError error={h.error || errorAccion} />
        </div>
      )}

      {h.cargando ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : h.cajas.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">No hay cajas.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {h.cajas.map((c) => (
            <li key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--c-borde)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">{c.sucursal}</p>
                  <p className="text-xs text-neutral-400 mt-1 truncate">
                    {c.usuarios.length ? c.usuarios.map((u) => u.nombre).join(', ') : 'Sin empleados asignados'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">Papel de {c.anchoPapel} mm</p>
                  {c.turnoAbierto && <p className="text-xs text-emerald-700 mt-1">Turno abierto: {c.turnoAbierto.usuario}</p>}
                </div>
                <Insignia activo={c.activo} textoInactivo="Desactivada" />
              </div>
              <div className="flex gap-2 mt-3">
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setFormulario(c)}>
                  Editar
                </Boton>
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setImprimiendo(c)}>
                  Impresión
                </Boton>
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setConfirmar(c)}>
                  {c.activo ? 'Desactivar' : 'Activar'}
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formulario && (
        <FormularioCaja
          key={formulario.id ?? 'nueva'}
          caja={formulario.id ? formulario : null}
          sucursales={h.sucursales}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {imprimiendo && (
        <ModalImpresionCaja
          key={imprimiendo.id}
          caja={imprimiendo}
          onGuardar={(datos) => h.actualizar(imprimiendo.id, datos)}
          onCerrar={() => setImprimiendo(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar}
        titulo={confirmar?.activo ? 'Desactivar caja' : 'Activar caja'}
        mensaje={
          confirmar?.activo
            ? `"${confirmar?.nombre}" dejará de poder abrir turnos. Nada se borra y podrás activarla otra vez.`
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