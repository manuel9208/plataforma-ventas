import { useState } from 'react';
import * as svc from '../../../services/sucursalesGlobal.service.js';
import { formatearFechaLarga } from '../../../utils/formato.js';
import { nombreZona } from '../../../utils/zonasHorarias.js';
import Boton from '../../shared/Boton.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import Insignia from '../../shared/Insignia.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import ModalMotivo from '../../shared/ModalMotivo.jsx';
import FormularioSucursal from './FormularioSucursal.jsx';
import { useSucursales } from './useSucursales.js';

export default function SucursalesEmpresa({ empresaId }) {
  const lista = useSucursales(empresaId);
  const [formulario, setFormulario] = useState(null); // { sucursal? }
  const [dandoBaja, setDandoBaja] = useState(null);
  const [reactivando, setReactivando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const darDeBaja = async (motivo) => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await svc.darDeBaja(empresaId, dandoBaja.id, motivo);
      setDandoBaja(null);
      lista.recargar();
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const reactivar = async () => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await svc.reactivar(empresaId, reactivando.id);
      lista.recargar();
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setReactivando(null);
      setProcesando(false);
    }
  };

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <p className="text-sm text-neutral-500 max-w-2xl">
          Aquí das de alta las sucursales con su nombre. El cliente completa su teléfono, dirección y ubicación en Configuración, y asigna sus productos y servicios.
        </p>
        <Boton className="shrink-0" onClick={() => setFormulario({})}>
          Nueva sucursal
        </Boton>
      </div>

      {(lista.error || errorAccion) && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={lista.error || errorAccion} />
        </div>
      )}

      {lista.cargando && !lista.datos.length ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : !lista.datos.length ? (
        !lista.error && <p className="text-neutral-500">Esta empresa aún no tiene sucursales.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.datos.map((s) => (
            <li
              key={s.id}
              className={`rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col ${s.activo ? '' : 'opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight truncate">{s.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">{s.direccion || 'Sin dirección todavía'}</p>
                </div>
                <Insignia activo={s.activo} textoActivo="Activa" textoInactivo="De baja" />
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                {s.cajas} {s.cajas === 1 ? 'caja' : 'cajas'} · {s.empleados} {s.empleados === 1 ? 'empleado' : 'empleados'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {nombreZona(s.zonaHoraria)}
                {s.zonaPropia ? '' : ' (la de la empresa)'}
              </p>
              {!s.activo && (
                <p className="mt-2 text-xs text-red-700">
                  De baja el {formatearFechaLarga(s.bajaEn)}: {s.bajaMotivo}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-[var(--c-borde)] grid grid-cols-2 gap-2 mt-auto">
                <Boton compacto variante="secundario" onClick={() => setFormulario({ sucursal: s })}>
                  Editar
                </Boton>
                {s.activo ? (
                  <Boton
                    compacto
                    variante="secundario"
                    onClick={() => {
                      setErrorAccion('');
                      setDandoBaja(s);
                    }}
                  >
                    Dar de baja
                  </Boton>
                ) : (
                  <Boton
                    compacto
                    variante="secundario"
                    onClick={() => {
                      setErrorAccion('');
                      setReactivando(s);
                    }}
                  >
                    Reactivar
                  </Boton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formulario && lista.empresa && (
        <FormularioSucursal
          empresa={lista.empresa}
          sucursal={formulario.sucursal}
          onGuardada={() => {
            setFormulario(null);
            lista.recargar();
          }}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {dandoBaja && (
        <ModalMotivo
          titulo="Dar de baja la sucursal"
          mensaje={`${dandoBaja.nombre} dejará de aparecer para el cliente. No se borra nada y la puedes reactivar.`}
          textoConfirmar="Dar de baja"
          cargando={procesando}
          error={errorAccion}
          onConfirmar={darDeBaja}
          onCancelar={() => setDandoBaja(null)}
        />
      )}

      <ConfirmModal
        abierto={!!reactivando}
        titulo="Reactivar sucursal"
        mensaje={`${reactivando?.nombre} volverá a estar disponible.`}
        textoConfirmar="Reactivar"
        cargando={procesando}
        onConfirmar={reactivar}
        onCancelar={() => setReactivando(null)}
      />
    </section>
  );
}