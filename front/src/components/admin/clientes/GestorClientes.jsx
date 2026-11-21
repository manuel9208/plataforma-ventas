import { useState } from 'react';
import * as svc from '../../../services/clientes.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { tienePermiso } from '../../../utils/permisos.js';
import { formatearTelefono } from '../../../utils/formato.js';
import { textoCumple } from '../../../utils/cumpleanos.js';
import { useClientes } from './useClientes.js';
import FormularioCliente from './FormularioCliente.jsx';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import ModalPinCliente from '../../shared/ModalPinCliente.jsx';
import ModalPuntosCliente from './ModalPuntosCliente.jsx';

const INPUT = 'min-h-12 px-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';
const SELECT = 'flex-1 min-h-11 px-3 rounded-2xl bg-white border border-[var(--c-borde)] text-sm outline-none focus:border-[var(--c-acento)]';

export default function GestorClientes() {
  const { usuario, tieneModulo } = useAuth();
  const conPuntos = tieneModulo('promociones');
  const h = useClientes();
  const esGlobal = usuario.rol === 'adminglobal';
  const puedeRestablecer = tienePermiso(usuario.permisos, 'clientes.restablecer_pin');

  const [formulario, setFormulario] = useState(null); // null cerrado, {} nuevo, objeto = cliente a editar
  const [abriendo, setAbriendo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [confirmarPin, setConfirmarPin] = useState(null);
  const [generando, setGenerando] = useState(null);
  const [pinNuevo, setPinNuevo] = useState(null); // { pin, nombre, reemplazo }
  const [verPuntos, setVerPuntos] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  // Abrir la ficha queda en la bitácora
  const editar = async (c) => {
    setErrorAccion('');
    setAbriendo(c.id);
    try {
      setFormulario(await svc.obtener(c.id));
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

  const generarPin = async (c) => {
    setErrorAccion('');
    setGenerando(c.id);
    try {
      const r = await h.generarPin(c.id);
      setPinNuevo({ pin: r.pin, nombre: c.nombre, reemplazo: r.reemplazo });
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setGenerando(null);
      setConfirmarPin(null);
    }
  };

  // Crear el primero es directo; restablecer pide confirmar (el anterior deja de servir)
  const pedirPin = (c) => (c.tienePin ? setConfirmarPin(c) : generarPin(c));

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="tel"
          inputMode="numeric"
          value={h.telefono}
          onChange={(e) => h.setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="Buscar por teléfono"
          className={`sm:w-64 ${INPUT}`}
        />
        <input value={h.nombre} onChange={(e) => h.setNombre(e.target.value)} placeholder="Buscar por nombre" className={`flex-1 ${INPUT}`} />
        <Boton onClick={() => setFormulario({})}>Nuevo</Boton>
      </div>

      <div className="flex gap-3 mb-4">
        <select aria-label="Estado" value={h.estado} onChange={(e) => h.setEstado(e.target.value)} className={SELECT}>
          <option value="activos">Activos</option>
          <option value="inactivos">Dados de baja</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Perfil" value={h.perfil} onChange={(e) => h.setPerfil(e.target.value)} className={SELECT}>
          <option value="todos">Todos los perfiles</option>
          <option value="incompleto">Perfil incompleto</option>
          <option value="completo">Perfil completo</option>
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
        <p className="text-center text-neutral-400 py-10">No hay clientes.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {h.datos.map((c) => (
            <li key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--c-borde)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.nombre}</p>
                  <p className="text-sm text-neutral-500">{formatearTelefono(c.telefono)}</p>
                  {c.correo && <p className="text-xs text-neutral-400 truncate">{c.correo}</p>}
                  {c.cumpleanos && <p className="text-xs text-neutral-400">Cumpleaños: {textoCumple(c.cumpleanos)}</p>}
                  <p className="text-xs text-neutral-400 mt-1">{c.aceptaWhatsapp ? 'Acepta avisos por WhatsApp' : 'Sin avisos por WhatsApp'}</p>
                  {c.perfil.completo ? (
                    <span className="mt-2 inline-block rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1">Perfil completo</span>
                  ) : (
                    <span className="mt-2 inline-block rounded-full bg-amber-50 text-amber-800 text-xs font-semibold px-2.5 py-1">
                      Falta: {c.perfil.falta.join(', ')}
                    </span>
                  )}
                </div>
                <Insignia activo={c.activo} textoInactivo="De baja" />
              </div>
              <div className="flex gap-2 mt-3">
                <Boton compacto variante="secundario" className="flex-1" cargando={abriendo === c.id} onClick={() => editar(c)}>
                  Editar
                </Boton>
                <Boton compacto variante="secundario" className="flex-1" onClick={() => setConfirmar(c)}>
                  {c.activo ? 'Dar de baja' : 'Reactivar'}
                </Boton>
              </div>
              {c.activo && !esGlobal && (!c.tienePin || puedeRestablecer) && (
                <Boton compacto variante="secundario" className="w-full mt-2" cargando={generando === c.id} onClick={() => pedirPin(c)}>
                  {c.tienePin ? 'Restablecer PIN' : 'Generar PIN'}
                </Boton>
              )}
              {conPuntos && c.activo && (
                <Boton compacto variante="secundario" className="w-full mt-2" onClick={() => setVerPuntos(c)}>
                  Puntos
                </Boton>
              )}
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
        <FormularioCliente
          key={formulario.id ?? 'nuevo'}
          cliente={formulario.id ? formulario : null}
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar}
        titulo={confirmar?.activo ? 'Dar de baja' : 'Reactivar cliente'}
        mensaje={
          confirmar?.activo
            ? `"${confirmar?.nombre}" dejará de aparecer en las búsquedas de Caja. Su historial se conserva y podrás reactivarlo.`
            : `"${confirmar?.nombre}" volverá a estar disponible.`
        }
        textoConfirmar={confirmar?.activo ? 'Dar de baja' : 'Reactivar'}
        peligro={!!confirmar?.activo}
        cargando={procesando}
        onConfirmar={cambiarEstado}
        onCancelar={() => setConfirmar(null)}
      />

      <ConfirmModal
        abierto={!!confirmarPin}
        titulo="Restablecer PIN"
        mensaje={`Se creará un PIN nuevo para "${confirmarPin?.nombre}" y el anterior dejará de servir. Se mostrará una sola vez.`}
        textoConfirmar="Restablecer"
        peligro
        cargando={generando === confirmarPin?.id}
        onConfirmar={() => generarPin(confirmarPin)}
        onCancelar={() => setConfirmarPin(null)}
      />

      {verPuntos && <ModalPuntosCliente key={verPuntos.id} cliente={verPuntos} onCerrar={() => setVerPuntos(null)} />}

      {pinNuevo && <ModalPinCliente pin={pinNuevo.pin} nombre={pinNuevo.nombre} reemplazo={pinNuevo.reemplazo} onCerrar={() => setPinNuevo(null)} />}
    </>
  );
}