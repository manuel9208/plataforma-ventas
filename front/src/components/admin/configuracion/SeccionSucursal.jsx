import { useState } from 'react';
import { ZONAS } from '../../../utils/zonasHorarias.js';
import { textoError } from '../../../utils/textoError.js';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);
const claseSelect =
  'w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

// Datos de la sucursal que elige el selector "Aplica a". Solo cambia lo que el cliente modifica.
export default function SeccionSucursal({ s, puedeCambiarPrincipal, onGuardar }) {
  const [f, setF] = useState({
    nombre: s.nombre,
    telefono: s.telefono ?? '',
    direccion: s.direccion ?? '',
    referencias: s.referencias ?? '',
    mapaUrl: s.mapaUrl ?? '',
    lat: s.lat === null ? '' : String(s.lat),
    lon: s.lon === null ? '' : String(s.lon),
    zonaHoraria: s.zonaHoraria,
    esPrincipal: s.esPrincipal,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);

  const poner = (k, v) => {
    setGuardado(false);
    setF((p) => ({ ...p, [k]: v }));
  };

  const zonas = ZONAS.some(([id]) => id === f.zonaHoraria) ? ZONAS : [...ZONAS, [f.zonaHoraria, f.zonaHoraria]];
  const telefonoCompleto = f.telefono === '' || f.telefono.length === 10;
  const ubicacionOk = (f.lat === '' && f.lon === '') || (f.lat !== '' && f.lon !== '' && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)));

  const cambios = {};
  if (f.nombre.trim() !== s.nombre) cambios.nombre = f.nombre.trim();
  if (f.telefono !== (s.telefono ?? '')) cambios.telefono = f.telefono || null;
  if (f.direccion.trim() !== (s.direccion ?? '')) cambios.direccion = f.direccion.trim() || null;
  if (f.zonaHoraria !== s.zonaHoraria) cambios.zonaHoraria = f.zonaHoraria;
  if (f.referencias.trim() !== (s.referencias ?? '')) cambios.referencias = f.referencias.trim() || null;
  if (f.mapaUrl.trim() !== (s.mapaUrl ?? '')) cambios.mapaUrl = f.mapaUrl.trim() || null;
  const mapaOk = f.mapaUrl.trim() === '' || /^https?:\/\/\S+$/i.test(f.mapaUrl.trim());
  const latNueva = f.lat === '' ? null : Number(f.lat);
  const lonNueva = f.lon === '' ? null : Number(f.lon);
  if (latNueva !== s.lat || lonNueva !== s.lon) {
    cambios.lat = latNueva;
    cambios.lon = lonNueva;
  }
  if (f.esPrincipal && !s.esPrincipal) cambios.esPrincipal = true;

  const hayCambios = Object.keys(cambios).length > 0;
  const puedeGuardar = hayCambios && f.nombre.trim().length >= 2 && telefonoCompleto && ubicacionOk && mapaOk;

  const guardar = async (e) => {
    e.preventDefault();
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar(cambios);
      setGuardado(true);
    } catch (err) {
      setError(textoError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 sm:p-6 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] mb-5">
      <p className="text-lg font-semibold tracking-tight">Mi sucursal</p>
      <p className="text-sm text-neutral-500">Los datos de esta sucursal. Salen en los tickets y en la portada.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} maxLength={80} required />
        <Campo
          etiqueta="Teléfono (10 dígitos)"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={f.telefono}
          onChange={(e) => poner('telefono', soloDigitos(e.target.value, 10))}
          ayuda={f.telefono && f.telefono.length < 10 ? 'Faltan dígitos' : 'Sale en el ticket'}
        />
        <Campo className="sm:col-span-2" etiqueta="Dirección" value={f.direccion} onChange={(e) => poner('direccion', e.target.value)} maxLength={200} />
      </div>

      <details className="mt-4 rounded-2xl border border-[var(--c-borde)] px-4 py-3">
        <summary className="cursor-pointer font-medium min-h-8 flex items-center">Zona horaria</summary>
        <div className="mt-3">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-600 mb-1.5">Zona horaria</span>
            <select value={f.zonaHoraria} onChange={(e) => poner('zonaHoraria', e.target.value)} className={claseSelect}>
              {zonas.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
            <span className="block text-xs text-neutral-500 mt-1">
              Define la fecha de los turnos y los cortes. No se puede cambiar mientras haya un turno abierto.
            </span>
          </label>
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-[var(--c-borde)] px-4 py-3">
        <summary className="cursor-pointer font-medium min-h-8 flex items-center">Ubicación en el mapa (opcional)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Latitud" type="number" step="any" inputMode="decimal" value={f.lat} onChange={(e) => poner('lat', e.target.value)} />
          <Campo etiqueta="Longitud" type="number" step="any" inputMode="decimal" value={f.lon} onChange={(e) => poner('lon', e.target.value)} />
          <p className="sm:col-span-2 text-xs text-neutral-500">
            Sirve para que la portada pública sugiera la sucursal más cercana. Escribe las dos o deja ambas vacías.
          </p>
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-[var(--c-borde)] px-4 py-3">
        <summary className="cursor-pointer font-medium min-h-8 flex items-center">Cómo llegar (opcional)</summary>
        <div className="mt-3 grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-600 mb-1.5">Referencias</span>
            <textarea
              value={f.referencias}
              rows={3}
              maxLength={300}
              onChange={(e) => poner('referencias', e.target.value)}
              placeholder="Ejemplo: frente al parque, junto a la farmacia"
              className="w-full px-4 py-3 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
            />
          </label>
          <Campo
            etiqueta="Enlace del mapa"
            type="url"
            value={f.mapaUrl}
            maxLength={300}
            onChange={(e) => poner('mapaUrl', e.target.value)}
            ayuda={mapaOk ? 'Pega el enlace de Google Maps. Sirve para que tus clientes lleguen.' : 'Debe empezar con http:// o https://'}
          />
        </div>
      </details>

      {puedeCambiarPrincipal && (
        <div className="mt-4">
          <Interruptor
            etiqueta="Es la sucursal principal"
            descripcion="La que se muestra primero en la portada pública."
            valor={f.esPrincipal}
            // Una vez principal no se quita aquí: se elige otra como principal
            disabled={s.esPrincipal}
            onCambiar={(v) => poner('esPrincipal', v)}
          />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <MensajeError error={error} />
        </div>
      )}
      {guardado && !hayCambios && <p className="mt-4 text-sm text-emerald-700">Cambios guardados</p>}

      <div className="mt-5">
        <Boton type="submit" disabled={!puedeGuardar} cargando={guardando} className="w-full sm:w-auto">
          Guardar mi sucursal
        </Boton>
      </div>
    </form>
  );
}