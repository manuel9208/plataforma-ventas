import { useEffect, useId, useState } from 'react';
import * as svc from '../../services/caja.service.js';
import Campo from '../shared/Campo.jsx';

// Texto libre con sugerencias de lo ya usado. Si no hay sugerencias, funciona como un campo normal.
export default function CampoSugerido({ campo, etiqueta, valor, onCambio, obligatorio }) {
  const id = useId();
  const [opciones, setOpciones] = useState([]);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await svc.sugerencias(campo, valor.trim() || undefined);
        if (vivo) setOpciones(r);
      } catch {
        if (vivo) setOpciones([]);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [campo, valor]);

  return (
    <>
      <Campo
        etiqueta={obligatorio ? `${etiqueta} *` : etiqueta}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        list={id}
        maxLength={60}
        autoComplete="off"
        required={obligatorio}
      />
      <datalist id={id}>
        {opciones.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}