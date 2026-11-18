import { TIPOS_PROMOCION, textoPromocion, textoVigencia } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Interruptor from '../../shared/Interruptor.jsx';

const ESTADOS = {
  vigente: { texto: 'Vigente ahora', clase: 'bg-emerald-50 text-emerald-800' },
  fuera_de_horario: { texto: 'Esperando su horario', clase: 'bg-amber-50 text-amber-800' },
  programada: { texto: 'Programada', clase: 'bg-amber-50 text-amber-800' },
  vencida: { texto: 'Vencida', clase: 'bg-neutral-100 text-neutral-600' },
  apagada: { texto: 'Apagada', clase: 'bg-neutral-100 text-neutral-600' },
};

export default function TarjetaPromocion({ promo, nombres, abriendo, onEditar, onEncender, onBaja }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const estado = ESTADOS[promo.estado] ?? ESTADOS.apagada;
  const tipo = TIPOS_PROMOCION.find((t) => t.id === promo.tipo)?.nombre ?? promo.tipo;

  const conocidas = promo.sucursalIds.map((id) => nombres.get(id)).filter(Boolean);
  const otras = promo.sucursalIds.length - conocidas.length;
  const donde = promo.sucursalIds.length === 0 ? 'Todas las sucursales' : [...conocidas, ...(otras ? [`${otras} más`] : [])].join(', ');

  return (
    <li className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_10px_24px_-18px_rgba(22,29,51,0.35)] flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{tipo}</p>
          <p className="text-lg font-semibold tracking-tight truncate">{promo.nombre}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight">{textoPromocion(promo, dinero)}</p>
      <p className="text-sm text-neutral-500 mt-1">{textoVigencia(promo)}</p>
      <p className="text-sm text-neutral-500">{donde}</p>

      {promo.puedeEditar ? (
        <div className="mt-4 space-y-3 mt-auto pt-4">
          <Interruptor etiqueta="Encendida" valor={promo.encendida} onCambiar={onEncender} />
          <div className="flex gap-2">
            <Boton compacto variante="secundario" className="flex-1" cargando={abriendo} onClick={onEditar}>
              Editar
            </Boton>
            <Boton compacto variante="secundario" className="flex-1" onClick={onBaja}>
              Dar de baja
            </Boton>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">Solo la puede cambiar quien tiene acceso a todas sus sucursales.</p>
      )}
    </li>
  );
}