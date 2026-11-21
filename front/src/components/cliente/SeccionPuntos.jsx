import { useEffect, useState } from 'react';
import * as svc from '../../services/miCuenta.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCliente } from '../../context/ClienteContext.jsx';
import { formatearFechaLarga, formatearMoneda } from '../../utils/formato.js';
import MensajeError from '../shared/MensajeError.jsx';
import ListaMovimientosPuntos from '../shared/ListaMovimientosPuntos.jsx';

export default function SeccionPuntos() {
  const { empresa } = useAuth();
  const { cliente } = useCliente();
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: '' });

  useEffect(() => {
    let vivo = true;
    svc
      .puntos()
      .then((d) => vivo && setEstado({ cargando: false, datos: d, error: '' }))
      .catch((e) => vivo && setEstado({ cargando: false, datos: null, error: e.message }));
    return () => {
      vivo = false;
    };
  }, []);

  if (estado.cargando) return <p className="text-center text-neutral-400 py-10">Cargando…</p>;
  if (estado.error) return <MensajeError error={estado.error} />;

  const d = estado.datos;
  if (!d.activo && d.saldo === 0 && d.movimientos.length === 0) {
    return <p className="text-center text-neutral-500 py-10">Por ahora esta tienda no tiene puntos activos.</p>;
  }

  return (
    <div className="max-w-xl space-y-5">
      {!cliente.perfil.completo && (
        <div className="rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
          Para empezar a ganar puntos completa tu perfil. Falta: {cliente.perfil.falta.join(', ')}.
        </div>
      )}

      <div className="text-center rounded-3xl bg-white border border-[var(--c-borde)] p-6">
        <p className="text-sm text-neutral-500">Tus puntos</p>
        <p className="text-6xl font-semibold tracking-tight">{d.saldo}</p>
        <p className="text-sm text-neutral-500 mt-1">Equivalen a {formatearMoneda(d.valor, empresa.moneda)}</p>
        {d.porVencer && (
          <p className="text-xs text-amber-700 mt-3">
            {d.porVencer.puntos} {d.porVencer.puntos === 1 ? 'punto vence' : 'puntos vencen'} el {formatearFechaLarga(d.porVencer.fecha)}
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
        <h3 className="font-semibold tracking-tight mb-1">Tus movimientos</h3>
        <ListaMovimientosPuntos movimientos={d.movimientos} />
      </div>
    </div>
  );
}