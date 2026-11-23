import { useState } from 'react';
import * as svc from '../../../services/reportes.service.js';
import Boton from '../../shared/Boton.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const MAX_FILAS = 5000;

// consulta: useReporteVentas.consultaExportar · columnas: ids de las columnas que se ven · total: registros del reporte
export default function BotonesExportar({ consulta, columnas, total }) {
  const [haciendo, setHaciendo] = useState(null); // 'pdf' | 'excel' mientras se arma el archivo
  const [error, setError] = useState('');

  const descargar = async (formato) => {
    if (!consulta || haciendo) return;
    setError('');
    setHaciendo(formato);
    try {
      await svc.exportar(formato, { ...consulta, columnas: columnas.join(',') });
    } catch (e) {
      setError(e.message);
    } finally {
      setHaciendo(null);
    }
  };

  const bloqueado = !consulta || Boolean(haciendo);

  return (
    <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">Descargar este reporte</h3>
          <p className="text-xs text-neutral-500">
            Lleva todo el periodo, con los filtros y las columnas que elegiste. Puede tardar unos segundos.
          </p>
        </div>
        <div className="flex gap-2">
          <Boton compacto cargando={haciendo === 'pdf'} disabled={bloqueado} onClick={() => descargar('pdf')}>
            {haciendo === 'pdf' ? 'Preparando…' : 'PDF'}
          </Boton>
          <Boton compacto variante="secundario" cargando={haciendo === 'excel'} disabled={bloqueado} onClick={() => descargar('excel')}>
            {haciendo === 'excel' ? 'Preparando…' : 'Excel'}
          </Boton>
        </div>
      </div>

      {total > MAX_FILAS && (
        <p className="mt-3 text-xs text-amber-700">
          Hay {total.toLocaleString('es-MX')} registros. El archivo lleva los primeros {MAX_FILAS.toLocaleString('es-MX')}: acota el periodo o los filtros para verlos todos.
        </p>
      )}
      {error && (
        <div className="mt-3 max-w-xl">
          <MensajeError error={error} />
        </div>
      )}
    </div>
  );
}