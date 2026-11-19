import { useState } from 'react';
import { DIAS, TIPOS_PROMOCION, nombreLlevaPaga, textoPromocion, validarPromocion } from '@plataforma/calculos';
import { textoError } from '../../../utils/textoError.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Selector from '../../shared/Selector.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import Plegable from '../../shared/Plegable.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import SelectorObjetivos from './SelectorObjetivos.jsx';
import SelectorArticulosCombo from './SelectorArticulosCombo.jsx';

const numero = (s) => (s === '' ? null : Number(s));
const PLACEHOLDER = { descuento: 'Ejemplo: 10% en limpieza', happy_hour: 'Ejemplo: Martes de bolsas', combo: 'Ejemplo: Tenis + gorra' };
const BOTON_ACTIVO = 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]';
const OPCIONES_LLEVA = Array.from({ length: 9 }, (_, i) => i + 2);

// d = promoción tal como la manda el servidor (o null si es nueva)
function estadoInicial(d, opciones) {
  return {
    tipo: d?.tipo ?? null,
    nombre: d?.nombre ?? '',
    modo: d?.modo ?? 'porcentaje',
    valor: d?.valor == null ? '' : String(d.valor),
    precioCombo: d?.precioCombo == null ? '' : String(d.precioCombo),
    lleva: d?.lleva == null ? '2' : String(d.lleva),
    paga: d?.paga == null ? '1' : String(d.paga),
    aplicaA: d?.aplicaA ?? 'todo',
    objetivos: d?.objetivos ?? [],
    items: d?.items ?? [],
    // Sin acceso a todas las sucursales no existe "todas": se usan las propias
    algunas: d ? d.sucursalIds.length > 0 : !opciones.puedeTodas,
    sucursalIds: d ? d.sucursalIds : opciones.puedeTodas ? [] : opciones.sucursales.map((s) => s.id),
    desde: d?.desde ?? '',
    hasta: d?.hasta ?? '',
    dias: d?.dias ?? [],
    horaDesde: d?.horaDesde ?? '14:00',
    horaHasta: d?.horaHasta ?? '17:00',
  };
}

function aDatos(f) {
  const combo = f.tipo === 'combo';
  const llevaPaga = f.tipo === 'lleva_paga';
  const descuento = f.tipo === 'descuento' || f.tipo === 'happy_hour';
  const lleva = llevaPaga ? Number(f.lleva) : null;
  const paga = llevaPaga ? numero(f.paga) : null;
  return {
    // En "lleva y paga" el nombre es opcional: si va vacío se llama 2x1, 3x2, 3x1.5...
    nombre: f.nombre.trim() || (llevaPaga && paga ? nombreLlevaPaga(lleva, paga) : ''),
    tipo: f.tipo,
    modo: descuento ? f.modo : null,
    valor: descuento ? numero(f.valor) : null,
    precioCombo: combo ? numero(f.precioCombo) : null,
    lleva,
    paga,
    aplicaA: f.aplicaA,
    objetivos: f.objetivos,
    items: f.items,
    sucursalIds: f.sucursalIds,
    desde: f.desde || null,
    hasta: f.hasta || null,
    dias: f.dias,
    horaDesde: f.horaDesde,
    horaHasta: f.horaHasta,
  };
}

// El servidor no acepta ids vacíos dentro de los artículos del combo: se quitan
const aCuerpo = (p) => ({
  ...p,
  items: p.items.map((i) => ({
    ...(i.presentacionId != null ? { presentacionId: i.presentacionId } : {}),
    ...(i.servicioId != null ? { servicioId: i.servicioId } : {}),
    ...(i.tipoArticuloId != null ? { tipoArticuloId: i.tipoArticuloId } : {}),
    cantidad: i.cantidad,
  })),
});

export default function FormularioPromocion({ inicial, opciones, onGuardar, onCerrar }) {
  const editando = Boolean(inicial);
  const [f, setF] = useState(() => estadoInicial(inicial, opciones));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const poner = (campo, valor) => {
    setError('');
    setF((p) => ({ ...p, [campo]: valor }));
  };

  // Primero se elige el tipo (al editar ya viene elegido y no se cambia)
  if (!f.tipo) {
    return (
      <Modal abierto titulo="¿Qué promoción quieres crear?" onCerrar={onCerrar}>
        <div className="grid gap-3">
          {TIPOS_PROMOCION.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => poner('tipo', t.id)}
              className="text-left rounded-2xl border border-[var(--c-borde)] bg-white p-4 min-h-16 hover:border-[var(--c-acento)] transition"
            >
              <span className="block font-semibold">{t.nombre}</span>
              <span className="block text-sm text-neutral-500">{t.descripcion}</span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  const tipo = TIPOS_PROMOCION.find((t) => t.id === f.tipo);
  const combo = f.tipo === 'combo';
  const llevaPaga = f.tipo === 'lleva_paga';
  const esDescuento = f.tipo === 'descuento' || f.tipo === 'happy_hour';
  const pagaNumero = numero(f.paga);
  const nombreAuto = llevaPaga && pagaNumero ? nombreLlevaPaga(Number(f.lleva), pagaNumero) : '';

  const guardar = async () => {
    if (f.algunas && f.sucursalIds.length === 0) {
      setError('Elige al menos una sucursal');
      return;
    }
    // Las mismas reglas que revisa el servidor: aquí solo avisan antes
    const r = validarPromocion(aDatos(f));
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await onGuardar(inicial?.id ?? null, aCuerpo(r.valor));
      onCerrar();
    } catch (e) {
      setError(textoError(e));
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-2xl"
      titulo={editando ? `Editar · ${tipo.nombre}` : `Nueva promoción · ${tipo.nombre}`}
      onCerrar={guardando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" cargando={guardando} onClick={guardar}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <Campo
          etiqueta={llevaPaga ? 'Nombre (opcional)' : 'Nombre *'}
          value={f.nombre}
          maxLength={60}
          placeholder={llevaPaga ? nombreAuto || 'Se llena solo' : PLACEHOLDER[f.tipo]}
          onChange={(e) => poner('nombre', e.target.value)}
          ayuda={llevaPaga ? `Si lo dejas vacío se llamará ${nombreAuto || '2x1'}. Dos promociones activas no pueden llamarse igual.` : 'Lo verás tú y el cajero.'}
        />

        {llevaPaga && (
          <div className="space-y-3 rounded-2xl border border-[var(--c-borde)] p-4">
            <div className="grid grid-cols-2 gap-3">
              <Selector etiqueta="El cliente lleva" value={f.lleva} onChange={(e) => poner('lleva', e.target.value)}>
                {OPCIONES_LLEVA.map((n) => (
                  <option key={n} value={n}>
                    {n} piezas
                  </option>
                ))}
              </Selector>
              <Campo
                etiqueta="Y paga"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0.5"
                value={f.paga}
                onChange={(e) => poner('paga', e.target.value)}
              />
            </div>
            {pagaNumero > 0 && (
              <p className="text-sm font-semibold text-neutral-700">
                {textoPromocion({ tipo: 'lleva_paga', lleva: Number(f.lleva), paga: pagaNumero })}
              </p>
            )}
            <p className="text-xs text-neutral-500">
              Paga lo más caro y se lleva gratis lo más barato. Con decimales, por ejemplo 1.5, una pieza sale completa y otra a mitad de precio.
              Cada servicio cuenta como una pieza.
            </p>
          </div>
        )}

        {esDescuento && (
          <>
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1.5">¿Cuánto descuentas?</p>
              <Segmentos
                opciones={[
                  { id: 'porcentaje', nombre: 'Porcentaje (%)' },
                  { id: 'monto', nombre: 'Dinero ($)' },
                ]}
                valor={f.modo}
                onCambio={(v) => poner('modo', v)}
              />
            </div>
            <Campo
              etiqueta={f.modo === 'porcentaje' ? 'Porcentaje de descuento' : 'Monto de descuento'}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={f.modo === 'porcentaje' ? 99 : undefined}
              value={f.valor}
              onChange={(e) => poner('valor', e.target.value)}
              ayuda={f.modo === 'porcentaje' ? 'De 1 a 99.' : 'Se resta del precio de cada pieza.'}
            />
          </>
        )}

        {f.tipo === 'happy_hour' && (
          <div className="space-y-4 rounded-2xl border border-[var(--c-borde)] p-4">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">¿Qué días?</p>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const on = f.dias.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => poner('dias', on ? f.dias.filter((x) => x !== d.id) : [...f.dias, d.id])}
                      className={`min-h-11 min-w-12 px-3 rounded-xl text-sm font-semibold transition ${on ? BOTON_ACTIVO : 'bg-white border border-[var(--c-borde)] text-neutral-600'}`}
                    >
                      {d.corto}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500 mt-1.5">Si no marcas ninguno, aplica todos los días.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Desde las" type="time" value={f.horaDesde} onChange={(e) => poner('horaDesde', e.target.value)} />
              <Campo etiqueta="Hasta las" type="time" value={f.horaHasta} onChange={(e) => poner('horaHasta', e.target.value)} />
            </div>
            <p className="text-xs text-neutral-500">Es la hora de cada sucursal.</p>
          </div>
        )}

        {!combo && (
          <>
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1.5">¿A qué se aplica?</p>
              <Segmentos
                opciones={[
                  { id: 'todo', nombre: 'A todo lo que vendo' },
                  { id: 'seleccion', nombre: 'Solo a lo que elija' },
                ]}
                valor={f.aplicaA}
                onCambio={(v) => poner('aplicaA', v)}
              />
              <p className="text-xs text-neutral-500 mt-1.5">
                {llevaPaga
                  ? 'Los extras de los servicios y lo que se vende por peso o medida no entran.'
                  : 'Los extras de los servicios no llevan descuento.'}
              </p>
            </div>
            {f.aplicaA === 'seleccion' && <SelectorObjetivos opciones={opciones} valor={f.objetivos} onCambio={(v) => poner('objetivos', v)} />}
          </>
        )}

        {combo && (
          <>
            <Campo
              etiqueta="Precio del combo"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={f.precioCombo}
              onChange={(e) => poner('precioCombo', e.target.value)}
              ayuda="Lo que paga el cliente por todo el combo."
            />
            <SelectorArticulosCombo opciones={opciones} valor={f.items} onCambio={(v) => poner('items', v)} />
          </>
        )}

        <Plegable titulo="Fechas y sucursales (opcional)" abiertaInicial={editando && Boolean(f.desde || f.hasta || f.algunas)}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Empieza el" type="date" value={f.desde} onChange={(e) => poner('desde', e.target.value)} />
            <Campo etiqueta="Termina el" type="date" value={f.hasta} onChange={(e) => poner('hasta', e.target.value)} />
          </div>
          <p className="text-xs text-neutral-500">Si no pones fechas, vale siempre.</p>

          {opciones.sucursales.length > 1 && (
            <div className="space-y-3">
              {opciones.puedeTodas ? (
                <Segmentos
                  opciones={[
                    { id: 'todas', nombre: 'En todas las sucursales' },
                    { id: 'algunas', nombre: 'Solo en algunas' },
                  ]}
                  valor={f.algunas ? 'algunas' : 'todas'}
                  onCambio={(v) => {
                    setError('');
                    setF((p) => ({ ...p, algunas: v === 'algunas', sucursalIds: v === 'todas' ? [] : p.sucursalIds }));
                  }}
                />
              ) : (
                <p className="text-xs text-neutral-500">Solo puedes usar tus sucursales.</p>
              )}
              {f.algunas && (
                <div className="grid gap-2">
                  {opciones.sucursales.map((s) => {
                    const on = f.sucursalIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 min-h-11 px-4 rounded-xl border border-[var(--c-borde)] bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => poner('sucursalIds', on ? f.sucursalIds.filter((x) => x !== s.id) : [...f.sucursalIds, s.id])}
                          className="size-5 accent-[var(--c-primario)]"
                        />
                        <span>{s.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Plegable>

        <MensajeError error={error} />
      </div>
    </Modal>
  );
}