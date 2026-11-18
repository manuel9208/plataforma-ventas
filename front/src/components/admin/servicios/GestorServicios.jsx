import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import * as svc from '../../../services/servicios.service.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { useServicios } from './useServicios.js';
import FormularioServicio from './FormularioServicio.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import ModalMotivo from '../../shared/ModalMotivo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const SELECT = 'flex-1 min-h-11 px-3 rounded-2xl bg-white border border-neutral-300 text-sm outline-none focus:border-[var(--c-primario)]';

const textoEntrega = (dias) => (dias === null ? null : dias === 0 ? 'Entrega el mismo día' : `Entrega en ${dias} día${dias === 1 ? '' : 's'}`);

export default function GestorServicios() {
  const { empresa } = useAuth();
  const h = useServicios();
  const [formulario, setFormulario] = useState(null); // null cerrado, {} nuevo, objeto = servicio a editar
  const [abriendo, setAbriendo] = useState(null);
  const [baja, setBaja] = useState(null);
  const [errorBaja, setErrorBaja] = useState('');
  const [reactivar, setReactivar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const faltaDepartamento = h.opcionesListas && h.opciones.departamentos.length === 0;
  const faltaTipo = h.opcionesListas && h.opciones.tiposArticulo.length === 0;
  const noPuedeCrear = !h.opcionesListas || faltaDepartamento || faltaTipo;

  // Para editar se trae el detalle completo (precios, sucursales y extras)
  const editar = async (s) => {
    setErrorAccion('');
    setAbriendo(s.id);
    try {
      setFormulario(await svc.obtener(s.id));
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setAbriendo(null);
    }
  };

  const guardar = (datos) => (formulario.id ? h.actualizar(formulario.id, datos) : h.crear(datos));

  const darDeBaja = async (motivo) => {
    setProcesando(true);
    setErrorBaja('');
    try {
      await h.actualizar(baja.id, { activo: false, motivoBaja: motivo });
      setBaja(null);
    } catch (e) {
      setErrorBaja(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const reactivarServicio = async () => {
    setProcesando(true);
    try {
      await h.actualizar(reactivar.id, { activo: true });
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setReactivar(null);
      setProcesando(false);
    }
  };

  return (
    <>
      {faltaDepartamento && (
        <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-neutral-200/70">
          Antes de crear servicios necesitas al menos un departamento. Créalo en Catálogo → Departamentos.
        </p>
      )}
      {faltaTipo && (
        <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-neutral-200/70">
          Antes de crear servicios necesitas al menos un tipo de artículo (tenis, gorra…). Créalo en Catálogo → Tipos de artículo.
        </p>
      )}

      <div className="flex gap-3 mb-3">
        <input
          value={h.buscar}
          onChange={(e) => h.setBuscar(e.target.value)}
          placeholder="Buscar por nombre o SKU"
          className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton onClick={() => setFormulario({})} disabled={noPuedeCrear}>
          Nuevo
        </Boton>
      </div>

      <div className="flex gap-3 mb-4">
        <select aria-label="Estado" value={h.estado} onChange={(e) => h.setEstado(e.target.value)} className={SELECT}>
          <option value="activos">Activos</option>
          <option value="inactivos">Dados de baja</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Departamento" value={h.departamentoId} onChange={(e) => h.setDepartamentoId(e.target.value)} className={SELECT}>
          <option value="">Todos los departamentos</option>
          {h.opciones.departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
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
        <p className="text-center text-neutral-400 py-10">No hay servicios.</p>
      ) : (
        <ul className="space-y-3">
          {h.datos.map((s) => (
            <li key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{s.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">
                    SKU {s.sku} · {s.departamento.nombre}
                  </p>
                  <p className="text-sm mt-1">
                    {s.precios.length
                      ? s.precios.map((p) => `${p.tipo} ${formatearMoneda(p.precio, empresa.moneda)}`).join(' · ')
                      : 'Sin precios'}
                  </p>
                  {textoEntrega(s.tiempoDias) && <p className="text-xs text-neutral-400">{textoEntrega(s.tiempoDias)}</p>}
                </div>
                <Insignia activo={s.activo} textoInactivo="De baja" />
              </div>
              <div className="flex gap-2 mt-3">
                <Boton compacto variante="secundario" className="flex-1" cargando={abriendo === s.id} onClick={() => editar(s)}>
                  Editar
                </Boton>
                {s.activo ? (
                  <Boton compacto variante="secundario" className="flex-1" onClick={() => { setErrorBaja(''); setBaja(s); }}>
                    Dar de baja
                  </Boton>
                ) : (
                  <Boton compacto variante="secundario" className="flex-1" onClick={() => setReactivar(s)}>
                    Reactivar
                  </Boton>
                )}
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
        <FormularioServicio
          key={formulario.id ?? 'nuevo'}
          servicio={formulario.id ? formulario : null}
          opciones={h.opciones}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {baja && (
        <ModalMotivo
          titulo="Dar de baja"
          mensaje={`"${baja.nombre}" dejará de ofrecerse. No se borra nada y podrás reactivarlo cuando quieras.`}
          textoConfirmar="Dar de baja"
          cargando={procesando}
          error={errorBaja}
          onConfirmar={darDeBaja}
          onCancelar={() => setBaja(null)}
        />
      )}

      <ConfirmModal
        abierto={!!reactivar}
        titulo="Reactivar servicio"
        mensaje={`"${reactivar?.nombre}" volverá a estar disponible.`}
        textoConfirmar="Reactivar"
        cargando={procesando}
        onConfirmar={reactivarServicio}
        onCancelar={() => setReactivar(null)}
      />
    </>
  );
}