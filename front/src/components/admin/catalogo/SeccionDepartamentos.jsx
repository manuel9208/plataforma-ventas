import GestorCatalogo from './GestorCatalogo.jsx';

const CAMPOS = [
  { clave: 'nombre', etiqueta: 'Nombre *', requerido: true, ayuda: 'Ejemplo: Lácteos, Protección, Higiene' },
];

export default function SeccionDepartamentos() {
  return (
    <GestorCatalogo
      entidad="departamentos"
      aviso="El código de dos dígitos se asigna solo y no cambia. Es la base del SKU de cada artículo."
      textos={{
        buscar: 'Buscar departamento',
        vacio: 'Aún no hay departamentos. Crea el primero con "Nuevo".',
        nuevo: 'Nuevo departamento',
        editar: 'Editar departamento',
      }}
      campos={CAMPOS}
      describir={(d) => ({ titulo: d.nombre, detalle: `Código ${d.codigo} · SKU desde ${d.codigo}0001` })}
    />
  );
}