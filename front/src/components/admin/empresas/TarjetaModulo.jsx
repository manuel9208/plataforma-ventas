import { useState } from 'react';
import { formatearFechaLarga, formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Insignia from '../../shared/Insignia.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const COBRO = { empresa: 'Por empresa', sucursal: 'Por sucursal' };

// Convierte lo que se escribe a lo que espera el servidor ("" = usar el sugerido)
const aPrecio = (t) => (t === '' ? null : Number(t));

export default function TarjetaModulo({ modulo: m, sucursales, moneda, onGuardar }) {
  const dinero = (v) => formatearMoneda(v, moneda);
  const [activo, setActivo] = useState(m.activo);
  const [precio, setPrecio] = useState(m.precioPropio === null ? '' : String(m.precioPropio));
  const [vence, setVence] = useState(m.venceEn ?? '');
  const [nota, setNota] = useState(m.nota ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const sinCambios =
    activo === m.activo && aPrecio(precio) === m.precioPropio && (vence || null) === m.venceEn && (nota.trim() || null) === (m.nota ?? null);

  const precioValido = precio === '' || (Number.isFinite(Number(precio)) && Number(precio) >= 0);

  const guardar = async () => {
    if (!precioValido || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar(m.clave, {
        activo: m.esBase ? true : activo,
        precioPropio: aPrecio(precio),
        venceEn: m.esBase ? null : vence || null,
        nota: nota.trim() || null,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const precioActual = precio === '' ? m.precioSugerido : Number(precio);
  const costoAhora = m.cobro === 'sucursal' ? precioActual * sucursales : precioActual;

  return (
    <li className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight">{m.nombre}</p>
          <p className="text-sm text-neutral-500">{m.descripcion}</p>
        </div>
        {m.vencido ? (
          <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ring-1 bg-amber-50 text-amber-700 ring-amber-200">Vencido</span>
        ) : (
          <Insignia activo={m.funcionando} textoActivo="Encendido" textoInactivo="Apagado" />
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        {COBRO[m.cobro]}
        {m.cobro === 'sucursal' ? ` · ${sucursales} ${sucursales === 1 ? 'sucursal' : 'sucursales'}` : ''}
        {m.venceEn ? ` · vence el ${formatearFechaLarga(m.venceEn)}` : ''}
      </p>

      <div className="mt-3">
        {m.esBase ? (
          <p className="text-sm text-neutral-500 bg-[#faf8f3] rounded-xl px-3 py-2">Siempre encendido: es la mensualidad del sistema.</p>
        ) : (
          <Interruptor etiqueta="Encendido" valor={activo} onCambiar={setActivo} />
        )}
      </div>

      <div className="mt-3">
        <Campo
          etiqueta="Precio al mes"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder={String(m.precioSugerido)}
          ayuda={
            precio === ''
              ? `Si lo dejas vacío usa el sugerido (${dinero(m.precioSugerido)}).`
              : `Cuesta ${dinero(costoAhora)} al mes${m.cobro === 'sucursal' ? ' con las sucursales actuales' : ''}.`
          }
        />
      </div>

      <details className="mt-3 rounded-2xl border border-[var(--c-borde)] px-4 py-3">
        <summary className="cursor-pointer font-medium min-h-8 flex items-center">Vencimiento y nota</summary>
        <div className="mt-3 space-y-3">
          {!m.esBase && (
            <Campo
              etiqueta="Vence el (opcional)"
              type="date"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
              ayuda="Al llegar esta fecha el módulo deja de funcionar. Sirve para pruebas gratis."
            />
          )}
          <Campo etiqueta="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ej. prueba de 30 días" />
        </div>
      </details>

      {error && (
        <div className="mt-3">
          <MensajeError error={error} />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--c-borde)] mt-auto">
        <Boton className="w-full" compacto disabled={sinCambios || !precioValido} cargando={guardando} onClick={guardar}>
          Guardar
        </Boton>
      </div>
    </li>
  );
}