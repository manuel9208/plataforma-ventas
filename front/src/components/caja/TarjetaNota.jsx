import { useAuth } from '../../context/AuthContext.jsx';
import { formatearFechaHora, formatearFechaLarga, formatearMoneda, formatearTelefono } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';

export default function TarjetaNota({ nota, pestana, onAbrir }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const debe = nota.saldo > 0;

  const partes = [];
  if (nota.estado === 'cancelada') partes.push('Cancelada');
  if (nota.enEspera) partes.push(`${nota.enEspera} en espera`);
  if (nota.porCotizar) partes.push(`${nota.porCotizar} por cotizar`);
  if (nota.listos) partes.push(`${nota.listos} ${nota.listos === 1 ? 'listo' : 'listos'}`);
  if (nota.entregados) partes.push(`${nota.entregados} ${nota.entregados === 1 ? 'entregado' : 'entregados'}`);

  return (
    <article className="rounded-3xl bg-white border border-[var(--c-borde)] shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] overflow-hidden">
      <button type="button" onClick={() => onAbrir(nota)} className="w-full text-left p-5 transition hover:bg-[#fbfaf6]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">{nota.folio}</p>
            <p className="text-sm text-neutral-600 truncate">{nota.cliente ? nota.cliente.nombre : 'Sin cliente'}</p>
            {nota.cliente && <p className="text-xs text-neutral-400">{formatearTelefono(nota.cliente.telefono)}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold">{dinero(nota.total)}</p>
            {debe ? (
              <p className="text-xs font-semibold text-amber-700">Debe {dinero(nota.saldo)}</p>
            ) : (
              <p className="text-xs font-semibold text-emerald-700">Pagada</p>
            )}
          </div>
        </div>
        {partes.length > 0 && <p className="mt-3 text-sm text-neutral-600">{partes.join(' · ')}</p>}
        <p className="mt-1 text-xs text-neutral-400">
          {nota.fechaPrometida ? `Entrega: ${formatearFechaLarga(nota.fechaPrometida)} · ` : ''}
          Recibida {formatearFechaHora(nota.creadaEn, nota.zonaHoraria)}
        </p>
      </button>

      {pestana === 'cobrar' && debe && (
        <div className="px-5 pb-5">
          <Boton compacto className="w-full" onClick={() => onAbrir(nota, 'cobrar')}>
            Cobrar saldo
          </Boton>
        </div>
      )}
      {pestana === 'espera' && (
        <div className="px-5 pb-5">
          {nota.porCotizar >= nota.enEspera ? (
            <Boton compacto variante="secundario" className="w-full" onClick={() => onAbrir(nota)}>
              Ver nota (falta cotizar)
            </Boton>
          ) : (
            <Boton compacto className="w-full" onClick={() => onAbrir(nota, 'listo')}>
              Marcar listo
            </Boton>
          )}
        </div>
      )}
      {pestana === 'entregar' && (
        <div className="px-5 pb-5">
          {debe ? (
            <Boton compacto variante="secundario" className="w-full" onClick={() => onAbrir(nota, 'cobrar')}>
              Cobrar saldo para entregar
            </Boton>
          ) : nota.porCotizar > 0 ? (
            <Boton compacto variante="secundario" className="w-full" onClick={() => onAbrir(nota)}>
              Ver nota (falta cotizar)
            </Boton>
          ) : (
            <Boton compacto className="w-full" onClick={() => onAbrir(nota, 'entregar')}>
              Entregar
            </Boton>
          )}
        </div>
      )}
    </article>
  );
}