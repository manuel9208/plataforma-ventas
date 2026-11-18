import { etiquetaEstado } from '@plataforma/calculos';

const COLORES = {
  recibido: 'bg-amber-50 text-amber-700 ring-amber-200',
  en_proceso: 'bg-amber-50 text-amber-700 ring-amber-200',
  listo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  entregado: 'bg-sky-50 text-sky-700 ring-sky-200',
  cancelado: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
};

export default function EtiquetaEstado({ estado }) {
  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${COLORES[estado] ?? COLORES.cancelado}`}>
      {etiquetaEstado(estado)}
    </span>
  );
}