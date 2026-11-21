import { useAuth } from '../../../context/AuthContext.jsx';
import { formatearMoneda } from '../../../utils/formato.js';

// El fondo va en el estilo de la tarjeta para que las letras blancas siempre tengan sobre qué verse
const FONDO_DESTACADO = {
  backgroundColor: '#1d2b4f',
  backgroundImage: 'linear-gradient(160deg, var(--c-primario-2), var(--c-primario))',
};

function Tarjeta({ titulo, valor, nota, destacada = false, clase = '' }) {
  return (
    <div
      style={destacada ? FONDO_DESTACADO : undefined}
      className={`rounded-3xl border p-5 ${destacada ? 'border-transparent' : 'bg-white border-[var(--c-borde)]'}`}
    >
      <p className={`text-sm ${destacada ? 'text-white/80' : 'text-neutral-500'}`}>{titulo}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${destacada ? 'text-white' : clase}`}>{valor}</p>
      <p className={`mt-2 text-xs ${destacada ? 'text-white/70' : 'text-neutral-400'}`}>{nota}</p>
    </div>
  );
}

export default function TarjetasResumen({ cifras: c }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);
  const anteriores = c.porCobrarAnteriores;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta
          titulo="Vendido"
          valor={dinero(c.vendido)}
          nota={`${c.notas} ${c.notas === 1 ? 'nota o venta' : 'notas y ventas'}${c.canceladas ? ` · ${c.canceladas} cancelada${c.canceladas === 1 ? '' : 's'}` : ''}`}
        />
        <Tarjeta titulo="Abonado" valor={dinero(c.abonado)} nota="Lo que han pagado esas notas" />
        <Tarjeta titulo="Pendiente" valor={dinero(c.pendiente)} nota="Lo que esas notas todavía deben" clase={c.pendiente > 0 ? 'text-amber-700' : ''} />
        <Tarjeta titulo="Dinero que entró" valor={dinero(c.entro.total)} nota="Todo lo cobrado en el periodo, menos devoluciones" destacada />
      </div>
      {anteriores.monto > 0 && (
        <p className="rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
          Además, hay {dinero(anteriores.monto)} por cobrar de {anteriores.notas} {anteriores.notas === 1 ? 'nota' : 'notas'} de días anteriores.
        </p>
      )}
    </div>
  );
}