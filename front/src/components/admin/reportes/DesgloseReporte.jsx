import { useAuth } from '../../../context/AuthContext.jsx';
import { ETIQUETA_FORMA } from '../../../utils/formasPago.js';
import { formatearMoneda } from '../../../utils/formato.js';

const Bloque = ({ titulo, nota, children }) => (
  <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5">
    <h3 className="font-semibold tracking-tight">{titulo}</h3>
    {nota && <p className="text-xs text-neutral-500 mt-0.5">{nota}</p>}
    <div className="mt-3 divide-y divide-[var(--c-borde)] text-sm">{children}</div>
  </section>
);

const Fila = ({ etiqueta, valor, vacio }) => (
  <div className={`flex justify-between gap-3 py-2 ${vacio ? 'text-neutral-400' : ''}`}>
    <span>{etiqueta}</span>
    <span className="font-medium">{valor}</span>
  </div>
);

export default function DesgloseReporte({ cifras: c, esLimpieza }) {
  const { empresa } = useAuth();
  const dinero = (v) => formatearMoneda(v, empresa.moneda);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Bloque titulo="Cómo pagaron" nota="Dinero que entró en el periodo">
        {['efectivo', 'tarjeta', 'transferencia'].map((forma) => (
          <Fila key={forma} etiqueta={ETIQUETA_FORMA[forma]} valor={dinero(c.entro[forma])} vacio={c.entro[forma] === 0} />
        ))}
      </Bloque>

      {esLimpieza && (
        <Bloque titulo="Qué se vendió" nota="De lo levantado en el periodo">
          <Fila etiqueta="Notas de servicio" valor={dinero(c.vendidoNotas)} vacio={c.vendidoNotas === 0} />
          <Fila etiqueta="Ventas de mostrador" valor={dinero(c.vendidoVentas)} vacio={c.vendidoVentas === 0} />
        </Bloque>
      )}

      <Bloque titulo="Descuentos y cargos" nota="Incluidos en lo vendido">
        <Fila etiqueta="Por promociones" valor={dinero(c.descuentoPromocion)} vacio={c.descuentoPromocion === 0} />
        <Fila etiqueta="Descuentos manuales" valor={dinero(c.descuentoManual)} vacio={c.descuentoManual === 0} />
        <Fila etiqueta="Puntos usados" valor={dinero(c.puntosUsados)} vacio={c.puntosUsados === 0} />
        {esLimpieza && <Fila etiqueta="Financiamiento cobrado" valor={dinero(c.financiamiento)} vacio={c.financiamiento === 0} />}
        {c.iva > 0 && <Fila etiqueta="IVA" valor={dinero(c.iva)} />}
      </Bloque>
    </div>
  );
}