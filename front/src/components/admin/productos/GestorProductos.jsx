import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import * as svc from '../../../services/productos.service.js';
import { formatearMoneda } from '../../../utils/formato.js';
import { useProductos } from './useProductos.js';
import FormularioProducto from './FormularioProducto.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import ModalMotivo from '../../shared/ModalMotivo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const SELECT = 'flex-1 min-h-11 px-3 rounded-2xl bg-white border border-neutral-300 text-sm outline-none focus:border-[var(--c-primario)]';

export default function GestorProductos() {
  const { empresa } = useAuth();
  const h = useProductos();
  const [formulario, setFormulario] = useState(null); // null cerrado, {} nuevo, objeto = producto a editar
  const [abriendo, setAbriendo] = useState(null);
  const [baja, setBaja] = useState(null);
  const [errorBaja, setErrorBaja] = useState('');
  const [reactivar, setReactivar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const sinDepartamentos = h.opciones.departamentos.length === 0;

  // Para editar se trae el detalle completo (presentaciones, códigos y precios)
  const editar = async (p) => {
    setErrorAccion('');
    setAbriendo(p.id);
    try {
      setFormulario(await svc.obtener(p.id));
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

  const reactivarProducto = async () => {
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
      {sinDepartamentos && (
        <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-neutral-200/70">
          Antes de crear productos necesitas al menos un departamento. Créalo en Catálogo → Departamentos.
        </p>
      )}

      <div className="flex gap-3 mb-3">
        <input
          value={h.buscar}
          onChange={(e) => h.setBuscar(e.target.value)}
          placeholder="Buscar por nombre, SKU, marca o código"
          className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 outline-none focus:border-[var(--c-primario)]"
        />
        <Boton onClick={() => setFormulario({})} disabled={sinDepartamentos}>
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
        <p className="text-center text-neutral-400 py-10">No hay productos.</p>
      ) : (
        <ul className="space-y-3">
          {h.datos.map((p) => {
            const vendibles = p.presentaciones.filter((x) => x.seVende);
            const principal = vendibles[0];
            return (
              <li key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.nombre}</p>
                    <p className="text-sm text-neutral-500 truncate">
                      SKU {p.sku} · {p.departamento.nombre}
                      {p.marca ? ` · ${p.marca}` : ''}
                    </p>
                    <p className="text-sm mt-1">
                      {principal ? `${formatearMoneda(principal.precio, empresa.moneda)} · ${principal.nombre}` : 'Sin precio de venta'}
                      {vendibles.length > 1 ? ` · +${vendibles.length - 1} presentación(es)` : ''}
                    </p>
                  </div>
                  <Insignia activo={p.activo} textoInactivo="De baja" />
                </div>
                <div className="flex gap-2 mt-3">
                  <Boton compacto variante="secundario" className="flex-1" cargando={abriendo === p.id} onClick={() => editar(p)}>
                    Editar
                  </Boton>
                  {p.activo ? (
                    <Boton compacto variante="secundario" className="flex-1" onClick={() => { setErrorBaja(''); setBaja(p); }}>
                      Dar de baja
                    </Boton>
                  ) : (
                    <Boton compacto variante="secundario" className="flex-1" onClick={() => setReactivar(p)}>
                      Reactivar
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
          <Boton compacto variante="secundario" disabled={h.pagina >= h.totalPaginas} onClick={() => h.setPagina(h.pagina + 1)}>
            Siguiente
          </Boton>
        </div>
      )}

      {formulario && (
        <FormularioProducto
          key={formulario.id ?? 'nuevo'}
          producto={formulario.id ? formulario : null}
          opciones={h.opciones}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {baja && (
        <ModalMotivo
          titulo="Dar de baja"
          mensaje={`"${baja.nombre}" dejará de venderse. No se borra nada y podrás reactivarlo cuando quieras.`}
          textoConfirmar="Dar de baja"
          cargando={procesando}
          error={errorBaja}
          onConfirmar={darDeBaja}
          onCancelar={() => setBaja(null)}
        />
      )}

      <ConfirmModal
        abierto={!!reactivar}
        titulo="Reactivar producto"
        mensaje={`"${reactivar?.nombre}" volverá a estar disponible.`}
        textoConfirmar="Reactivar"
        cargando={procesando}
        onConfirmar={reactivarProducto}
        onCancelar={() => setReactivar(null)}
      />
    </>
  );
}