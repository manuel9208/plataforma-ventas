import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import MensajeError from '../../shared/MensajeError.jsx';
import FiltrosReporte from './FiltrosReporte.jsx';
import TarjetasResumen from './TarjetasResumen.jsx';
import DesgloseReporte from './DesgloseReporte.jsx';
import TotalesPorSucursal from './TotalesPorSucursal.jsx';
import TablaReporte from './TablaReporte.jsx';
import CobrosAnteriores from './CobrosAnteriores.jsx';
import EstadisticasVentas from './EstadisticasVentas.jsx';
import ConsumoVentas from './ConsumoVentas.jsx';
import AnalisisVentas from './AnalisisVentas.jsx';
import DetalleVentaReporte from './DetalleVentaReporte.jsx';
import ModalColumnas from './ModalColumnas.jsx';
import BotonesExportar from './BotonesExportar.jsx';
import { useReporteVentas } from './useReporteVentas.js';
import { useColumnasReporte } from './useColumnasReporte.js';

export default function ReporteVentas() {
  const { empresa } = useAuth();
  const esLimpieza = empresa.tipoNegocio === 'limpieza';
  const r = useReporteVentas();
  const col = useColumnasReporte(esLimpieza);
  const [eligiendo, setEligiendo] = useState(false);
  const [abierta, setAbierta] = useState(null); // id de la nota que se está viendo

  if (r.errorOpciones) {
    return (
      <div className="max-w-xl">
        <MensajeError error={r.errorOpciones} />
      </div>
    );
  }
  if (!r.opciones) return <p className="text-neutral-400">Cargando…</p>;

  const d = r.datos;

  return (
    <section className="space-y-5">
      <FiltrosReporte r={r} esLimpieza={esLimpieza} />

      <BotonesExportar consulta={r.consultaExportar} columnas={col.columnas.map((c) => c.id)} total={d?.total ?? 0} />

      {!r.validez.ok && r.validez.error && (
        <div className="max-w-xl">
          <MensajeError error={r.validez.error} />
        </div>
      )}
      {r.error && (
        <div className="max-w-xl">
          <MensajeError error={r.error} />
        </div>
      )}

      {!d && r.validez.ok && r.cargando && <p className="text-neutral-400">Cargando…</p>}

      {d && r.validez.ok && (
        <div className={`space-y-5 transition ${r.cargando ? 'opacity-60' : ''}`}>
          <TarjetasResumen cifras={d.cifras} />
          <DesgloseReporte cifras={d.cifras} esLimpieza={esLimpieza} />
          {d.porSucursal.length > 1 && <TotalesPorSucursal porSucursal={d.porSucursal} />}
          <TablaReporte
            columnas={col.columnas}
            filas={d.datos}
            total={d.total}
            pagina={d.pagina}
            limite={d.limite}
            orden={r.f.orden}
            direccion={r.f.direccion}
            onOrden={r.ordenar}
            onPagina={r.irAPagina}
            onColumnas={() => setEligiendo(true)}
            onAbrir={setAbierta}
          />
          {esLimpieza && r.f.giro !== 'productos' && r.consultaCobros && (
            <CobrosAnteriores key={JSON.stringify(r.consultaCobros)} consulta={r.consultaCobros} onAbrir={setAbierta} />
          )}
          <ConsumoVentas consulta={r.consultaConsumo} esLimpieza={esLimpieza} onOrden={(ordenConsumo) => r.cambiarOpcion({ ordenConsumo })} />
          <AnalisisVentas consulta={r.consultaAnalisis} esLimpieza={esLimpieza} onAbrir={setAbierta} />
          <EstadisticasVentas
            consulta={r.consultaEstadisticas}
            hoy={r.opciones.hoy}
            hastaHoy={r.f.hastaHoy}
            onHastaHoy={(hastaHoy) => r.cambiarOpcion({ hastaHoy })}
          />
        </div>
      )}

      {abierta && <DetalleVentaReporte id={abierta} onCerrar={() => setAbierta(null)} />}

      {eligiendo && (
        <ModalColumnas
          disponibles={col.disponibles}
          ids={col.ids}
          onAlternar={col.alternar}
          onRestablecer={col.restablecer}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </section>
  );
}