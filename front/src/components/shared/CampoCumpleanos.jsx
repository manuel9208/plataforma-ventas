import { useState } from 'react';
import { NOMBRES_MES_CUMPLE, diasMaximosDelMes } from '@plataforma/calculos';

const SELECT =
  'w-full min-h-12 px-3 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

// valor: { mes, dia } o null · onCambio recibe { mes, dia } cuando están los dos, o null (solo día y mes, sin año)
export default function CampoCumpleanos({ valor, onCambio, etiqueta = 'Cumpleaños', ayuda }) {
  const [mes, setMes] = useState(valor ? String(valor.mes) : '');
  const [dia, setDia] = useState(valor ? String(valor.dia) : '');

  const avisar = (m, d) => onCambio(m && d ? { mes: Number(m), dia: Number(d) } : null);

  const cambiarMes = (m) => {
    const max = m ? diasMaximosDelMes(Number(m)) : 31;
    const d = dia && Number(dia) > max ? '' : dia;
    setMes(m);
    setDia(d);
    avisar(m, d);
  };

  const cambiarDia = (d) => {
    setDia(d);
    avisar(mes, d);
  };

  const maxDias = mes ? diasMaximosDelMes(Number(mes)) : 31;

  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-600 mb-2">{etiqueta}</legend>
      <div className="grid grid-cols-2 gap-3">
        <select aria-label="Mes" value={mes} onChange={(e) => cambiarMes(e.target.value)} className={SELECT}>
          <option value="">Mes</option>
          {NOMBRES_MES_CUMPLE.map((n, i) => (
            <option key={n} value={i + 1}>
              {n[0].toUpperCase() + n.slice(1)}
            </option>
          ))}
        </select>
        <select aria-label="Día" value={dia} onChange={(e) => cambiarDia(e.target.value)} className={SELECT}>
          <option value="">Día</option>
          {Array.from({ length: maxDias }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </div>
      {ayuda && <p className="mt-1.5 text-xs text-neutral-500">{ayuda}</p>}
    </fieldset>
  );
}