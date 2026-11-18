import { formatearFechaLarga } from '../../utils/formato.js';
import EncabezadoApp from '../shared/EncabezadoApp.jsx';
import MensajeError from '../shared/MensajeError.jsx';
import AperturaTurno from './AperturaTurno.jsx';
import EstadoTurno from './EstadoTurno.jsx';
import CajaAbierta from './CajaAbierta.jsx';
import ResultadoCorte from './ResultadoCorte.jsx';
import { useTurno } from './useTurno.js';

const Aviso = ({ titulo, children }) => (
  <div className="max-w-md rounded-3xl bg-white border border-[var(--c-borde)] p-6">
    <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
    <p className="text-neutral-500 mt-2">{children}</p>
  </div>
);

export default function Caja() {
  const t = useTurno();
  const e = t.estado;

  return (
    <>
      <EncabezadoApp titulo="Caja" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-4 pb-28 lg:pb-6">
        {t.ultimoCierre && <ResultadoCorte cierre={t.ultimoCierre} />}

        {t.cargando ? (
          <p className="text-neutral-400">Cargando…</p>
        ) : t.error ? (
          <div className="max-w-md">
            <MensajeError error={t.error} />
          </div>
        ) : e.estado === 'sin_caja' ? (
          <Aviso titulo="Aún no tienes una caja">Pídele a tu gerente que te asigne una caja.</Aviso>
        ) : e.estado === 'caja_inactiva' ? (
          <Aviso titulo="Tu caja está desactivada">Avisa a tu gerente para que la active o te asigne otra.</Aviso>
        ) : e.estado === 'caja_ocupada' ? (
          <Aviso titulo="Esta caja ya está en uso">
            {e.ocupadaPor.usuario} tiene el turno abierto desde el {formatearFechaLarga(e.ocupadaPor.fechaOperativa)}. Pídele que lo cierre
            {e.turnoVencido ? ' o pídele a un gerente que lo cierre en Cajas → Turnos abiertos.' : '.'}
          </Aviso>
        ) : e.estado === 'sin_turno' ? (
          <AperturaTurno key={e.caja.id} estado={e} onAbrir={t.abrir} />
        ) : e.turnoVencido ? (
          <EstadoTurno key={e.turno.id} estado={e} onCerrar={t.cerrar} />
        ) : (
          <CajaAbierta key={e.turno.id} estado={e} onCerrar={t.cerrar} />
        )}
      </main>
    </>
  );
}