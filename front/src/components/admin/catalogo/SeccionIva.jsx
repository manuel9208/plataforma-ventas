import GestorCatalogo from './GestorCatalogo.jsx';
import Boton from '../../shared/Boton.jsx';

const CAMPOS = [
  { clave: 'nombre', etiqueta: 'Nombre *', requerido: true, ayuda: 'Ejemplo: General, Frontera, Tasa 0' },
  { clave: 'porcentaje', etiqueta: 'Porcentaje *', tipo: 'numero', requerido: true, paso: 0.01, min: 0, max: 100, ayuda: 'Ejemplo: 16' },
];

export default function SeccionIva() {
  return (
    <GestorCatalogo
      entidad="tasas-iva"
      aviso="Cambiar un porcentaje solo afecta ventas nuevas. Los tickets anteriores conservan el IVA con el que se hicieron."
      textos={{
        buscar: 'Buscar tasa',
        vacio: 'No hay tasas de IVA.',
        nuevo: 'Nueva tasa de IVA',
        editar: 'Editar tasa de IVA',
      }}
      campos={CAMPOS}
      describir={(t) => ({
        titulo: t.nombre,
        detalle: `${t.porcentaje}%`,
        etiqueta: t.esDefecto ? 'Predeterminada' : null,
      })}
      puedeCambiarEstado={(t) => !t.esDefecto}
      accionesExtra={(t, { actualizar }) =>
        !t.esDefecto && t.activo ? (
          <Boton compacto variante="secundario" className="flex-1" onClick={() => actualizar(t.id, { esDefecto: true })}>
            Predeterminada
          </Boton>
        ) : null
      }
    />
  );
}