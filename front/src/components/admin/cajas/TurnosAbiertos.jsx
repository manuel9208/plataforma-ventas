import { useCallback, useEffect, useState } from 'react';
import * as svc from '../../../services/turnos.service.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { tienePermiso } from '../../../utils/permisos.js';
import { textoDiferencia } from '../../../utils/corte.js';
import { formatearFechaLarga, formatearHora, formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Insignia from '../../shared/Insignia.jsx';
import ConfirmModal from '../../shared/ConfirmModal.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import ModalCorte from '../../caja/ModalCorte.jsx';
import DetalleCorte from './DetalleCorte.jsx';

export default function TurnosAbiertos() {
  const { usuario, empresa } = useAuth();
  const esGlobal = usuario.rol === 'adminglobal';
  const puedeVerCorte = esGlobal || tienePermiso(usuario.permisos, 'caja.corte_completo');
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const [viendo, setViendo] = useState(null); // turno del que se ve cómo va

  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setTurnos(await svc.abiertos());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mensajeCierre = (t, turno) => {
    const nombre = turno.usuario.nombre;
    const partes = [
      t.cierreTardio
        ? `Turno de ${nombre} cerrado con la fecha del ${formatearFechaLarga(t.fechaOperativa)}. Advertencia: no se cerró ese día, se cerró el ${formatearFechaLarga(t.cierreFecha)}.`
        : `Turno de ${nombre} cerrado.`,
    ];
    const c = t.corte;
    if (c?.vista === 'detallada') {
      partes.push(c.sinConteo ? 'Se cerró sin conteo de efectivo.' : `${textoDiferencia(c.resultado, c.diferencia, dinero)}. A entregar: ${dinero(c.entregado)}.`);
    } else if (c?.vista === 'ciega') {
      partes.push(`A entregar: ${dinero(c.entregar)}.`);
    }
    return partes.join(' ');
  };

  const cerrar = async (datos) => {
    const turno = confirmar;
    setProcesando(true);
    setError('');
    setAviso('');
    try {
      const t = await svc.cerrar(turno.id, datos);
      setAviso(mensajeCierre(t, turno));
      setConfirmar(null);
      await cargar();
    } catch (e) {
      setError(e.message);
      // El conteo se corrige dentro de la misma hoja; el administrador global ve el error en la lista
      if (esGlobal) setConfirmar(null);
    } finally {
      setProcesando(false);
    }
  };

    if (viendo) return <DetalleCorte turnoId={viendo} enCurso onVolver={() => setViendo(null)} />;

  return (
    <>
      <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-[var(--c-borde)]">
        Aquí ves los turnos que siguen abiertos. Si alguien olvidó cerrar el suyo, puedes hacer su corte: cuentas el efectivo de esa caja y se cierra con la fecha del día en que se abrió.
      </p>

      {error && !confirmar && (
        <div className="mb-4">
          <MensajeError error={error} />
        </div>
      )}
      {aviso && <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{aviso}</p>}

      {cargando ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : turnos.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">No hay turnos abiertos.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {turnos.map((t) => (
            <li key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--c-borde)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.caja.nombre}</p>
                  <p className="text-sm text-neutral-500 truncate">
                    {t.usuario.nombre} · {t.sucursal}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Abierto el {formatearFechaLarga(t.fechaOperativa)} a las {formatearHora(t.abiertoEn, t.zonaHoraria)}
                  </p>
                </div>
                <Insignia activo={!t.vencido} textoActivo="Abierto" textoInactivo="De otro día" />
              </div>
              <div className="mt-3 grid gap-2">
                {puedeVerCorte && t.usuario.id !== usuario.id && (
                  <Boton compacto variante="secundario" className="w-full" onClick={() => setViendo(t.id)}>
                    Ver cómo va
                  </Boton>
                )}
                <Boton
                  compacto
                  variante="secundario"
                  className="w-full"
                  onClick={() => {
                    setError('');
                    setConfirmar(t);
                  }}
                >
                  {esGlobal ? 'Cerrar turno' : 'Hacer corte'}
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmar && !esGlobal && (
        <ModalCorte
          titulo={`Corte de ${confirmar.usuario.nombre}`}
          descripcion={`Cuenta el efectivo que hay en ${confirmar.caja.nombre} y escribe cuánto se queda para mañana.${
            confirmar.vencido ? ` Se cerrará con la fecha del ${formatearFechaLarga(confirmar.fechaOperativa)} y quedará como cierre tardío.` : ''
          }`}
          enviando={procesando}
          error={error}
          onConfirmar={cerrar}
          onCerrar={() => setConfirmar(null)}
        />
      )}

      <ConfirmModal
        abierto={!!confirmar && esGlobal}
        titulo="Cerrar turno sin conteo"
        mensaje={`Se cerrará el turno de ${confirmar?.usuario.nombre} en ${confirmar?.caja.nombre} sin contar el efectivo. Quedará marcado como "sin conteo".`}
        textoConfirmar="Cerrar turno"
        peligro
        cargando={procesando}
        onConfirmar={() => cerrar(undefined)}
        onCancelar={() => setConfirmar(null)}
      />
    </>
  );
}