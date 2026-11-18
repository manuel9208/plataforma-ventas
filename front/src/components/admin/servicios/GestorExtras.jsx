import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import * as svc from '../../../services/extras.service.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { useExtras } from './useExtras.js';
import FormularioExtra from './FormularioExtra.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const SELECT = 'flex-1 min-h-11 px-3 rounded-2xl bg-white border border-neutral-300 text-sm outline-none focus:border-[var(--c-primario)]';

export default function GestorExtras() {
  const { empresa } = useAuth();
  const h = useExtras();
  const [formulario, setFormulario] = useState(null); // null cerrado, {} nuevo, objeto = extra a editar
  const [abriendo, setAbriendo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const nombreTasa = (id) => {
    const t = h.opciones.tasasIva.find((x) => x.id === id);
    return t ? `IVA ${t.porcentaje}%` : '';
  };

  // Para editar se trae el detalle con los precios por sucursal
  const editar = async (x) => {
    setErrorAccion('');
    setAbriendo(x.id);
    try {
      setFormulario(await svc.obtener(x.id));
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setAbriendo(null);
    }
  };

  const guardar = (datos) => (formulario.id ? h.actualizar(formulario.id, datos) : h.crear(datos));

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

  return (
    <>
      <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-neutral-200/70">
        Los extras son cobros adicionales de un servicio, como impermeabilizante o entrega a domicilio. Aquí los creas y en cada servicio eliges cuáles aplican.
      </p>

      <div className="flex gap-3 mb-3">
        <input
          value={h.buscar}
          onChange={(e) => h.setBuscar(e.target.value)}
          placeholder="Buscar extra"
          className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton onClick={() => setFormulario({})} disabled={!h.opcionesListas}>
          Nuevo
        </Boton>
      </div>

      <div className="flex gap-3 mb-4">
        <select aria-label="Estado" value={h.estado} onChange={(e) => h.setEstado(e.target.value)} className={SELECT}>
          <option value="activos">Activos</option>
          <option value="inactivos">Desactivados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {(h.error || errorAccion) && (
        <div className="mb-4">
          <MensajeError error={h.error || errorAccion} />
        </div>
      )}

      {h.cargando && h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : h.datos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">No hay extras.</p>
      ) : (
        <ul className="space-y-3">
          {h.datos.map((x) => (
            <li key={x.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{x.nombre}</p>
                  <p className="text-sm mt-1">
                    {formatearMoneda(x.precio, empresa.moneda)}
                    <span className="text-neutral-400"> · {nombreTasa(x.tasaIvaId)}</span>
                  </p>
                </div>
                <Insignia activo={x.activo} textoInactivo="Desactivado" />
              </div>
              <div className="flex gap-2 mt-3">
                <Boton compacto variante="secundario" className="flex-1" cargando={abriendo === x.id} onClick={() => editar(x)}>
                  Editar
                </Boton>
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setConfirmar(x)}>
                  {x.activo ? 'Desactivar' : 'Activar'}
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
        <FormularioExtra
          key={formulario.id ?? 'nuevo'}
          extra={formulario.id ? formulario : null}
          opciones={h.opciones}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar}
        titulo={confirmar?.activo ? 'Desactivar extra' : 'Activar extra'}
        mensaje={
          confirmar?.activo
            ? `"${confirmar?.nombre}" dejará de ofrecerse en los servicios nuevos. Podrás activarlo otra vez.`
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