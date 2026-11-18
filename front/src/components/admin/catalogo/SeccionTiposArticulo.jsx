import GestorCatalogo from './GestorCatalogo.jsx';

const CAMPOS = [{ clave: 'nombre', etiqueta: 'Nombre *', requerido: true, ayuda: 'Ejemplo: Tenis, Gorra, Bolsa' }];

export default function SeccionTiposArticulo() {
  return (
    <GestorCatalogo
      entidad="tipos-articulo"
      aviso="Son los artículos que recibe el negocio. Cada servicio tendrá un precio por tipo."
      textos={{
        buscar: 'Buscar tipo de artículo',
        vacio: 'Aún no hay tipos de artículo. Crea el primero con "Nuevo".',
        nuevo: 'Nuevo tipo de artículo',
        editar: 'Editar tipo de artículo',
      }}
      campos={CAMPOS}
      describir={(t) => ({ titulo: t.nombre })}
    />
  );
}