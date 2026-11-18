import { useState } from 'react';
import { useEmpleados } from './useEmpleados.js';
import FormularioEmpleado from './FormularioEmpleado.jsx';
import Boton from '../../shared/Boton.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import { formatearTelefono } from '../../../utils/formato.js';

export default function GestorEmpleados() {
  const h = useEmpleados();
  const [formulario, setFormulario] = useState(null); // null = cerrado, {} = nuevo, objeto = editar
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const nombresSucursales = (ids) =>
    ids.map((id) => h.opciones.sucursales.find((s) => s.id === id)?.nombre).filter(Boolean).join(', ');

  const guardar = (datos) => (formulario.id ? h.actualizar(formulario.id, datos) : h.crear(datos));

  const cambiarEstado = async () => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await h.actualizar(confirmar.id, { activo: !confirmar.activo });
      setConfirmar(null);
    } catch (e) {
      setErrorAccion(e.message);
      setConfirmar(null);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input
          value={h.buscar}
          onChange={(e) => h.setBuscar(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton onClick={() => setFormulario({})}>Nuevo</Boton>
      </div>

      {(h.error || errorAccion) && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{h.error || errorAccion}</p>
      )}

      {h.cargando && h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">No hay empleados.</p>
      ) : (
        <ul className="space-y-3">
          {h.datos.map((u) => (
            <li key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{u.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">
                    {formatearTelefono(u.telefono)} · {u.rol.nombre}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 truncate">{nombresSucursales(u.sucursalIds)}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                    u.activo ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setFormulario(u)}>
                  Editar
                </Boton>
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setConfirmar(u)}>
                  {u.activo ? 'Dar de baja' : 'Reactivar'}
                </Boton>
              </div>
            </li>
          ))}
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
          <Boton compacto variante="secundario" disabled={h.pagina >= h.totalPaginas} onClick={() => h.setPagina(h.pagina + 1)}>
            Siguiente
          </Boton>
        </div>
      )}

      {formulario && (
        <FormularioEmpleado
          key={formulario.id ?? 'nuevo'}
          empleado={formulario.id ? formulario : null}
          opciones={h.opciones}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar}
        titulo={confirmar?.activo ? 'Dar de baja' : 'Reactivar empleado'}
        mensaje={
          confirmar?.activo
            ? `${confirmar?.nombre} ya no podrá entrar al sistema. Podrás reactivarlo cuando quieras.`
            : `${confirmar?.nombre} volverá a poder entrar al sistema.`
        }
        textoConfirmar={confirmar?.activo ? 'Dar de baja' : 'Reactivar'}
        peligro={!!confirmar?.activo}
        cargando={procesando}
        onConfirmar={cambiarEstado}
        onCancelar={() => setConfirmar(null)}
      />
    </>
  );
}