import { useState } from 'react';
import { validarCupon } from '@plataforma/calculos';
import { textoError } from '../../../utils/textoError.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import BuscadorCliente from '../../caja/BuscadorCliente.jsx';

const MODOS = [
  { id: 'porcentaje', nombre: 'Porcentaje (%)' },
  { id: 'monto', nombre: 'Pesos ($)' },
];
const limpiarCodigo = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
const texto = (v) => (v === null || v === undefined ? '' : String(v));

// inicial: el cupón a editar (o null si es nuevo) · onGuardar(id | null, datos)
export default function FormularioCupon({ inicial, opciones, onGuardar, onCerrar }) {
  const esEdicion = Boolean(inicial);
  const propias = opciones.sucursales.map((s) => s.id);

  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [modo, setModo] = useState(inicial?.modo ?? 'porcentaje');
  const [valor, setValor] = useState(texto(inicial?.valor));
  const [codigo, setCodigo] = useState('');
  const [veces, setVeces] = useState(texto(inicial?.vecesPorCliente ?? 1));
  const [maxClientes, setMaxClientes] = useState(texto(inicial?.maxClientes));
  const [desde, setDesde] = useState(inicial?.desde ?? '');
  const [hasta, setHasta] = useState(inicial?.hasta ?? '');
  const [todas, setTodas] = useState(opciones.puedeTodas && (inicial ? inicial.sucursalIds.length === 0 : true));
  const [sucursales, setSucursales] = useState(inicial ? inicial.sucursalIds : propias);
  const [cliente, setCliente] = useState(null); // solo al crear
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const personal = esEdicion ? Boolean(inicial.clienteId) : Boolean(cliente);
  const alternar = (id) => setSucursales((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const cambiar = (poner) => (e) => {
    poner(e.target.value);
    setError('');
  };

  const guardar = async () => {
    const datos = {
      nombre,
      modo,
      valor: valor === '' ? NaN : Number(valor),
      desde: desde || null,
      hasta: hasta || null,
      vecesPorCliente: Number(veces),
      maxClientes: personal || maxClientes === '' ? null : Number(maxClientes),
      sucursalIds: todas ? [] : sucursales,
      ...(esEdicion ? {} : { codigo: codigo.trim() || null, clienteId: cliente?.id ?? null }),
    };
    // La misma revisión que hace el servidor
    const r = validarCupon({ ...datos, clienteId: esEdicion ? inicial.clienteId : datos.clienteId });
    if (!r.ok) return setError(r.error);
    if (!todas && sucursales.length === 0) return setError('Elige al menos una sucursal');

    setGuardando(true);
    try {
      await onGuardar(inicial?.id ?? null, datos);
      onCerrar();
    } catch (e) {
      setError(textoError(e));
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={esEdicion ? 'Editar cupón' : 'Nuevo cupón'}
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
        <Campo etiqueta="Nombre *" value={nombre} maxLength={60} placeholder="Ejemplo: Cumpleaños, Verano" onChange={cambiar(setNombre)} />

        <div className="space-y-3">
          <Segmentos
            opciones={MODOS}
            valor={modo}
            onCambio={(m) => {
              setModo(m);
              setError('');
            }}
          />
          <Campo
            etiqueta={modo === 'porcentaje' ? 'Porcentaje de descuento *' : 'Descuento en pesos *'}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={valor}
            onChange={cambiar(setValor)}
          />
        </div>

        {esEdicion ? (
          <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] px-4 py-3">
            <p className="text-xs text-neutral-500">Código (no se cambia)</p>
            <p className="font-mono text-lg font-semibold tracking-[0.2em]">{inicial.codigo}</p>
            {inicial.cliente && <p className="text-sm text-neutral-600 mt-1">Solo para {inicial.cliente.nombre}</p>}
          </div>
        ) : (
          <Campo
            etiqueta="Código (opcional)"
            value={codigo}
            maxLength={20}
            placeholder="Si lo dejas vacío, el sistema crea uno"
            onChange={(e) => {
              setCodigo(limpiarCodigo(e.target.value));
              setError('');
            }}
            ayuda="Letras y números, de 4 a 20, sin espacios."
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Veces por cliente *" type="number" inputMode="numeric" step="1" min="1" value={veces} onChange={cambiar(setVeces)} ayuda="Cuántas veces lo puede usar cada cliente." />
          {!personal && (
            <Campo
              etiqueta="Clientes que lo pueden usar"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={maxClientes}
              placeholder="Sin límite"
              onChange={cambiar(setMaxClientes)}
              ayuda="Cuántos clientes distintos."
            />
          )}
        </div>

        <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3">
          <summary className="cursor-pointer font-medium min-h-8 flex items-center">Vigencia (opcional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde" type="date" value={desde} onChange={cambiar(setDesde)} />
            <Campo etiqueta="Hasta" type="date" value={hasta} onChange={cambiar(setHasta)} />
          </div>
        </details>

        {opciones.sucursales.length > 1 && (
          <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={!opciones.puedeTodas}>
            <summary className="cursor-pointer font-medium min-h-8 flex items-center">¿En qué sucursales vale?</summary>
            <div className="mt-3 space-y-1">
              {opciones.puedeTodas && (
                <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                  <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-5 accent-[var(--c-primario)]" />
                  <span className="text-sm font-medium">Todas las sucursales</span>
                </label>
              )}
              {!todas &&
                opciones.sucursales.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 min-h-11 cursor-pointer">
                    <input type="checkbox" checked={sucursales.includes(s.id)} onChange={() => alternar(s.id)} className="size-5 accent-[var(--c-primario)]" />
                    <span className="text-sm">{s.nombre}</span>
                  </label>
                ))}
            </div>
          </details>
        )}

        {!esEdicion && (
          <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3">
            <summary className="cursor-pointer font-medium min-h-8 flex items-center">Solo para un cliente (opcional)</summary>
            <div className="mt-3 space-y-2">
              <BuscadorCliente
                onCambio={(envio, vista) => {
                  setCliente(envio?.clienteId ? { id: envio.clienteId, nombre: vista?.nombre ?? '' } : null);
                  setError('');
                }}
              />
              <p className="text-xs text-neutral-500">Elige un cliente que ya esté registrado. Solo él podrá usar este cupón.</p>
            </div>
          </details>
        )}

        <p className="text-xs text-neutral-500">Un cupón no se junta con promociones, descuentos ni puntos: en cada compra vale un solo beneficio.</p>
        <MensajeError error={error} />
      </div>
    </Modal>
  );
}