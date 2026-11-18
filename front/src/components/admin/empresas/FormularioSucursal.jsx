import { useState } from 'react';
import * as svc from '../../../services/sucursalesGlobal.service.js';
import { ZONAS } from '../../../utils/zonasHorarias.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const claseSelect =
  'w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

// Crear solo pide el nombre; la dirección y la zona horaria son opcionales (el cliente completa el resto en Configuración)
export default function FormularioSucursal({ empresa, sucursal, onGuardada, onCerrar }) {
  const editando = Boolean(sucursal);
  const zonaEmpresa = empresa.zonaHoraria;
  const [f, setF] = useState({
    nombre: sucursal?.nombre ?? '',
    direccion: sucursal?.direccion ?? '',
    zonaHoraria: sucursal?.zonaHoraria ?? zonaEmpresa,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const poner = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // Si la zona de la sucursal es la misma de la empresa no se guarda una propia: sigue a la empresa
  const zonas = ZONAS.some(([id]) => id === f.zonaHoraria) ? ZONAS : [...ZONAS, [f.zonaHoraria, f.zonaHoraria]];

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    try {
      const cuerpo = { nombre: f.nombre.trim(), direccion: f.direccion.trim(), zonaHoraria: f.zonaHoraria };
      if (editando) await svc.editar(empresa.id, sucursal.id, cuerpo);
      else await svc.crear(empresa.id, { nombre: cuerpo.nombre, ...(cuerpo.direccion ? { direccion: cuerpo.direccion } : {}), zonaHoraria: cuerpo.zonaHoraria });
      onGuardada();
    } catch (err) {
      setError([err.message, ...(err.detalles || []).map((d) => `${d.campo}: ${d.mensaje}`)].join(' · '));
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={editando ? 'Editar sucursal' : 'Nueva sucursal'}
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-sucursal" className="flex-1" cargando={enviando}>
            {editando ? 'Guardar' : 'Crear sucursal'}
          </Boton>
        </>
      }
    >
      <form id="form-sucursal" onSubmit={enviar} className="space-y-5">
        <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} maxLength={80} placeholder="Ej. Centro" required autoFocus />
        <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={editando}>
          <summary className="cursor-pointer font-medium min-h-8 flex items-center">Dirección y zona horaria (opcional)</summary>
          <div className="mt-3 space-y-4">
            <Campo etiqueta="Dirección" value={f.direccion} onChange={(e) => poner('direccion', e.target.value)} maxLength={200} />
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
                Define la fecha de los turnos y los cortes de esa sucursal. Si no la cambias, usa la de la empresa.
              </span>
            </label>
          </div>
        </details>
        <p className="text-xs text-neutral-500">El teléfono y la ubicación los completa el cliente en Configuración.</p>
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}