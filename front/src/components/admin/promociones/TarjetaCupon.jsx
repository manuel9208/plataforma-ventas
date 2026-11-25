import { useState } from 'react';
import { textoCupon } from '@plataforma/calculos';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';
import Boton from '../../shared/Boton.jsx';
import Interruptor from '../../shared/Interruptor.jsx';

const ESTADOS = {
  vigente: ['Vigente', 'bg-emerald-50 text-emerald-700'],
  apagado: ['Apagado', 'bg-neutral-100 text-neutral-500'],
  programado: ['Empieza pronto', 'bg-sky-50 text-sky-700'],
  vencido: ['Vencido', 'bg-red-50 text-red-700'],
  agotado: ['Agotado', 'bg-amber-50 text-amber-700'],
};

const fecha = (s) => {
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
};

const vigencia = (c) => {
  if (c.desde && c.hasta) return `Del ${fecha(c.desde)} al ${fecha(c.hasta)}`;
  if (c.desde) return `Desde el ${fecha(c.desde)}`;
  if (c.hasta) return `Hasta el ${fecha(c.hasta)}`;
  return 'Sin fecha límite';
};

export default function TarjetaCupon({ cupon, nombres, onEditar, onEncender, onBaja }) {
  const { empresa } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const [etiqueta, color] = ESTADOS[cupon.estado] ?? ESTADOS.apagado;

  const sucursales = cupon.sucursalIds.length
    ? cupon.sucursalIds.map((id) => nombres.get(id)).filter(Boolean).join(', ')
    : 'Todas las sucursales';

  const uso = cupon.cliente
    ? cupon.usos > 0
      ? 'Ya lo usó'
      : 'Sin usar'
    : cupon.maxClientes != null
      ? `${cupon.clientesUsados} de ${cupon.maxClientes} clientes lo han usado`
      : `${cupon.clientesUsados} ${cupon.clientesUsados === 1 ? 'cliente lo ha usado' : 'clientes lo han usado'}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cupon.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin permiso del navegador: el código se puede leer en la tarjeta
    }
  };

  return (
    <li className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 shadow-[0_14px_30px_-22px_rgba(22,29,51,0.25)] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold tracking-tight truncate">{cupon.nombre}</p>
          <p className="text-sm text-neutral-500">{textoCupon(cupon, (v) => formatearMoneda(v, empresa.moneda))}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{etiqueta}</span>
      </div>

      <button
        type="button"
        onClick={copiar}
        className="w-full min-h-12 rounded-2xl border-2 border-dashed border-[var(--c-acento)] bg-amber-50/40 font-mono text-lg font-semibold tracking-[0.2em]"
      >
        {cupon.codigo}
        <span className="block text-[11px] font-sans font-normal tracking-normal text-neutral-500">{copiado ? 'Copiado' : 'Toca para copiar'}</span>
      </button>

      <div className="text-sm text-neutral-600 space-y-1">
        <p>{vigencia(cupon)}</p>
        <p>{uso}</p>
        <p>Cada cliente: {cupon.vecesPorCliente} {cupon.vecesPorCliente === 1 ? 'vez' : 'veces'}</p>
        {cupon.cliente && <p className="font-medium text-[var(--c-primario)]">Solo para {cupon.cliente.nombre}</p>}
        <p className="text-xs text-neutral-400">{sucursales}</p>
      </div>

      {cupon.puedeEditar ? (
        <>
          <Interruptor etiqueta="Encendido" valor={cupon.encendido} onCambiar={onEncender} />
          <div className="flex gap-2 mt-auto">
            <Boton compacto variante="secundario" className="flex-1" onClick={onEditar}>
              Editar
            </Boton>
            <Boton compacto variante="secundario" className="flex-1" onClick={onBaja}>
              Dar de baja
            </Boton>
          </div>
        </>
      ) : (
        <p className="text-xs text-neutral-400">Vale en sucursales a las que no tienes acceso: solo puedes verlo.</p>
      )}
    </li>
  );
}