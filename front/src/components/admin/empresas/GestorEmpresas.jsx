import { useState } from 'react';
import * as svc from '../../../services/empresasGlobal.service.js';
import { formatearFechaLarga } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import Icono from '../../shared/Icono.jsx';
import Insignia from '../../shared/Insignia.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import ModalMotivo from '../../shared/ModalMotivo.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import FormularioEmpresa from './FormularioEmpresa.jsx';
import ModalEmpresaCreada from './ModalEmpresaCreada.jsx';
import { useEmpresas } from './useEmpresas.js';

const FILTROS = [
  { id: 'todas', nombre: 'Todas' },
  { id: 'activas', nombre: 'Activas' },
  { id: 'suspendidas', nombre: 'Suspendidas' },
];
const GIRO = { limpieza: 'Limpieza', super: 'Súper' };

export default function GestorEmpresas({ onAdministrar }) {
  const lista = useEmpresas();
  const [formulario, setFormulario] = useState(null); // { modo: 'crear' } o { modo: 'editar', empresa }
  const [creada, setCreada] = useState(null);
  const [suspendiendo, setSuspendiendo] = useState(null);
  const [reactivando, setReactivando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const suspender = async (motivo) => {
    setProcesando(true);
    setErrorAccion('');
    try {
      await svc.suspender(suspendiendo.id, motivo);
      setSuspendiendo(null);
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
      await svc.reactivar(reactivando.id);
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
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icono nombre="buscar" className="size-5" />
          </span>
          <input
            value={lista.buscar}
            onChange={(e) => lista.setBuscar(e.target.value)}
            placeholder="Busca por nombre o slug"
            className="w-full min-h-12 pl-12 pr-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
          />
        </div>
        <Boton onClick={() => setFormulario({ modo: 'crear' })}>Nueva empresa</Boton>
      </div>

      <Segmentos className="mb-5" opciones={FILTROS} valor={lista.estado} onCambio={lista.cambiarEstado} />

      {(lista.error || errorAccion) && (
        <div className="mb-4 max-w-xl">
          <MensajeError error={lista.error || errorAccion} />
        </div>
      )}

      {lista.cargando && !lista.datos.length ? (
        <p className="text-neutral-400">Cargando…</p>
      ) : !lista.datos.length ? (
        !lista.error && (
          <p className="text-neutral-500">{lista.consulta ? `No encontramos empresas con "${lista.consulta}".` : 'Aún no hay empresas.'}</p>
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.datos.map((e) => (
            <li
              key={e.id}
              className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight truncate">{e.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">
                    {e.slug} · {GIRO[e.tipoNegocio] ?? e.tipoNegocio}
                  </p>
                </div>
                <Insignia activo={!e.suspendida} textoActivo="Activa" textoInactivo="Suspendida" />
              </div>

              <p className="mt-3 text-sm text-neutral-600">
                {e.sucursales} {e.sucursales === 1 ? 'sucursal' : 'sucursales'} · {e.empleados} {e.empleados === 1 ? 'empleado' : 'empleados'}
              </p>
              <p className={`text-xs mt-1 ${e.dominios.length ? 'text-neutral-400' : 'text-amber-700'}`}>
                {e.dominios.length ? e.dominios.join(', ') : 'Sin dominio todavía: agrégalo con Editar cuando despliegues'}
              </p>
              {e.suspendida && (
                <p className="mt-2 text-xs text-red-700">
                  Suspendida el {formatearFechaLarga(e.suspendidaEn)}: {e.suspensionMotivo}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-[var(--c-borde)] grid grid-cols-2 gap-2 mt-auto">
                <Boton compacto className="col-span-2" onClick={() => onAdministrar(e)}>
                  Administrar
                </Boton>
                <Boton compacto variante="secundario" onClick={() => setFormulario({ modo: 'editar', empresa: e })}>
                  Editar
                </Boton>
                {e.suspendida ? (
                  <Boton
                    compacto
                    variante="secundario"
                    onClick={() => {
                      setErrorAccion('');
                      setReactivando(e);
                    }}
                  >
                    Reactivar
                  </Boton>
                ) : (
                  <Boton
                    compacto
                    variante="secundario"
                    onClick={() => {
                      setErrorAccion('');
                      setSuspendiendo(e);
                    }}
                  >
                    Suspender
                  </Boton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {lista.hayMas && (
        <div className="mt-6 flex justify-center">
          <Boton variante="secundario" cargando={lista.cargandoMas} onClick={lista.verMas}>
            Ver más
          </Boton>
        </div>
      )}

      {formulario && (
        <FormularioEmpresa
          modo={formulario.modo}
          empresa={formulario.empresa}
          onGuardada={(resultado) => {
            setFormulario(null);
            lista.recargar();
            if (resultado) setCreada(resultado);
          }}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {creada && <ModalEmpresaCreada creada={creada} onCerrar={() => setCreada(null)} />}

      {suspendiendo && (
        <ModalMotivo
          titulo="Suspender empresa"
          mensaje={`Nadie de ${suspendiendo.nombre} podrá entrar al sistema hasta que la reactives. No se borra nada.`}
          textoConfirmar="Suspender"
          cargando={procesando}
          error={errorAccion}
          onConfirmar={suspender}
          onCancelar={() => setSuspendiendo(null)}
        />
      )}

      <ConfirmModal
        abierto={!!reactivando}
        titulo="Reactivar empresa"
        mensaje={`${reactivando?.nombre} volverá a funcionar con normalidad.`}
        textoConfirmar="Reactivar"
        cargando={procesando}
        onConfirmar={reactivar}
        onCancelar={() => setReactivando(null)}
      />
    </section>
  );
}