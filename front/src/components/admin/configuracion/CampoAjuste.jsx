import { useMemo } from 'react';
import { TIPOS_TEXTO, horarioInicial, resolverPie } from '@plataforma/calculos';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import Segmentos from '../../shared/Segmentos.jsx';
import EditorHorario from './EditorHorario.jsx';
import EditorFechas from './EditorFechas.jsx';

const EJEMPLO = { empresa: 'Mi negocio', sucursal: 'Centro', direccion: 'Av. Principal 123', telefono_sucursal: '6671234567' };

const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Lo que se pone al elegir "Poner uno propio" si la empresa no tiene nada
function vacioDe(a) {
  if (a.tipo === 'booleano') return false;
  if (a.tipo === 'horario') return horarioInicial();
  if (a.tipo === 'fechas') return [];
  if (a.tipo === 'opcion') return a.opciones[0].valor;
  if (a.tipo === 'texto' || TIPOS_TEXTO.includes(a.tipo)) return '';
  return a.min ?? 0;
}

// a = ajuste que manda el servidor. borrador: undefined = sin cambios · valor = cambio · null = volver al de la empresa.
export default function CampoAjuste({ a, borrador, onCambio, enSucursal, variablesPie }) {
  const hayBorrador = borrador !== undefined;
  const heredando = enSucursal && (hayBorrador ? borrador === null : !a.propio);
  const valor = hayBorrador && borrador !== null ? borrador : (a.valor ?? '');

  const cambiar = (nuevo) => {
    // Si vuelve a ser igual a lo que ya estaba guardado, no hay cambio
    const igual = a.propio ? mismo(nuevo, a.valor) : false;
    onCambio(igual ? undefined : nuevo);
  };

  const ponerPropio = () => onCambio(a.valorEmpresa ?? vacioDe(a));
  const usarEmpresa = () => onCambio(a.propio ? null : undefined);

  const vistaPrevia = useMemo(() => (a.tipo === 'texto' ? resolverPie(String(valor), EJEMPLO) : []), [a.tipo, valor]);

  let control;
  if (a.tipo === 'booleano') {
    control = <Interruptor etiqueta={a.etiqueta} descripcion={a.descripcion} valor={Boolean(valor)} onCambiar={cambiar} disabled={heredando} />;
  } else if (a.tipo === 'opcion') {
    control = (
      <div>
        <p className="text-sm font-medium text-neutral-600 mb-1.5">{a.etiqueta}</p>
        <Segmentos
          opciones={a.opciones.map((o) => ({ id: o.valor, nombre: o.etiqueta }))}
          valor={valor}
          onCambio={(v) => !heredando && cambiar(v)}
          className={heredando ? 'opacity-60 pointer-events-none' : ''}
        />
        {a.descripcion && <p className="text-xs text-neutral-500 mt-1.5">{a.descripcion}</p>}
      </div>
    );
  } else if (a.tipo === 'texto') {
    control = (
      <div>
        <label className="block">
          <span className="block text-sm font-medium text-neutral-600 mb-1.5">{a.etiqueta}</span>
          <textarea
            value={valor}
            rows={4}
            maxLength={a.max}
            disabled={heredando}
            onChange={(e) => cambiar(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20 disabled:bg-neutral-100 disabled:text-neutral-500"
          />
          {a.descripcion && <span className="block text-xs text-neutral-500 mt-1">{a.descripcion}</span>}
        </label>
        {!heredando && (
          <div className="mt-2 flex flex-wrap gap-2">
            {variablesPie.map((v) => (
              <button
                key={v.clave}
                type="button"
                onClick={() => cambiar(`${valor}${valor && !valor.endsWith('\n') ? ' ' : ''}{${v.clave}}`)}
                className="min-h-9 px-3 rounded-lg border border-[var(--c-borde)] bg-white text-xs font-medium text-neutral-600 hover:border-[var(--c-acento)]"
              >
                + {v.etiqueta}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 rounded-xl bg-[#faf8f3] border border-[var(--c-borde)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-1">Así se verá (con datos de ejemplo)</p>
          {vistaPrevia.length ? (
            vistaPrevia.map((l, i) => (
              <p key={i} className="text-sm text-neutral-600">
                {l}
              </p>
            ))
          ) : (
            <p className="text-sm text-neutral-400">Sin texto al final del ticket.</p>
          )}
        </div>
      </div>
    );
  } else if (a.tipo === 'linea' || a.tipo === 'telefono' || a.tipo === 'correo') {
    control = (
      <Campo
        etiqueta={a.etiqueta}
        type={a.tipo === 'correo' ? 'email' : a.tipo === 'telefono' ? 'tel' : 'text'}
        inputMode={a.tipo === 'telefono' ? 'numeric' : undefined}
        autoComplete="off"
        maxLength={a.max ?? (a.tipo === 'telefono' ? 10 : 120)}
        disabled={heredando}
        value={valor}
        onChange={(e) => cambiar(a.tipo === 'telefono' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
        ayuda={a.descripcion}
      />
    );
  } else if (a.tipo === 'horario') {
    control = (
      <div>
        <p className="text-sm font-medium text-neutral-600 mb-1.5">{a.etiqueta}</p>
        <EditorHorario valor={valor || horarioInicial()} onCambio={cambiar} disabled={heredando} />
        {a.descripcion && <p className="text-xs text-neutral-500 mt-1.5">{a.descripcion}</p>}
      </div>
    );
  } else if (a.tipo === 'fechas') {
    control = (
      <div>
        <p className="text-sm font-medium text-neutral-600 mb-1.5">{a.etiqueta}</p>
        <EditorFechas valor={Array.isArray(valor) ? valor : []} onCambio={cambiar} disabled={heredando} />
        {a.descripcion && <p className="text-xs text-neutral-500 mt-1.5">{a.descripcion}</p>}
      </div>
    );
  } else {
    control = (
      <Campo
        etiqueta={a.etiqueta}
        type="number"
        inputMode="decimal"
        step={a.tipo === 'dinero' ? '0.01' : '1'}
        min={a.min ?? undefined}
        max={a.max ?? undefined}
        disabled={heredando}
        value={valor}
        onChange={(e) => e.target.value !== '' && cambiar(Number(e.target.value))}
        ayuda={a.descripcion}
      />
    );
  }

  return (
    <div className="space-y-2">
      {control}
      {enSucursal && (
        <div className="flex flex-wrap items-center gap-3">
          {heredando ? (
            <>
              <span className="text-xs text-neutral-500">Usa el de la empresa</span>
              <Boton compacto variante="secundario" onClick={ponerPropio}>
                Poner uno propio
              </Boton>
            </>
          ) : (
            <button
              type="button"
              onClick={usarEmpresa}
              className="min-h-9 text-xs font-medium text-[var(--c-primario-2)] underline underline-offset-4"
            >
              Usar el de la empresa
            </button>
          )}
        </div>
      )}
    </div>
  );
}