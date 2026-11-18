import { useMemo, useState } from 'react';
import { calcularLineaVenta, siguienteMayoreo, totalesVenta } from '@plataforma/calculos';

let contador = 0;
const nuevaClave = () => `a${++contador}`;

// Productos: un renglón por presentación. Servicios: un renglón por artículo (con sus extras).
// Los importes que se muestran son informativos: el servidor vuelve a calcular todo al cobrar.
export function useCarrito(incluyeIva) {
  const [renglones, setRenglones] = useState([]);
  const [articulos, setArticulos] = useState([]);

  const agregar = (producto, presentacion, cantidad = 1) =>
    setRenglones((actuales) => {
      const i = actuales.findIndex((r) => r.presentacion.id === presentacion.id);
      if (i === -1) return [...actuales, { producto, presentacion, cantidad }];
      const copia = [...actuales];
      copia[i] = { ...copia[i], cantidad: Number((copia[i].cantidad + cantidad).toFixed(3)) };
      return copia;
    });

  const poner = (presentacionId, cantidad) =>
    setRenglones((actuales) =>
      actuales.map((r) => (r.presentacion.id === presentacionId ? { ...r, cantidad: Number(Number(cantidad).toFixed(3)) } : r))
    );

  const quitar = (presentacionId) => setRenglones((actuales) => actuales.filter((r) => r.presentacion.id !== presentacionId));

  // datos: { articulo, extraIds, fechaPrometida, fechaMostrada }
  const agregarArticulo = (servicio, precio, datos) =>
    setArticulos((a) => [...a, { clave: nuevaClave(), servicio, precio, ...datos }]);

  const editarArticulo = (clave, datos) => setArticulos((a) => a.map((x) => (x.clave === clave ? { ...x, ...datos } : x)));

  const duplicarArticulo = (clave) =>
    setArticulos((a) => {
      const i = a.findIndex((x) => x.clave === clave);
      if (i === -1) return a;
      const copia = [...a];
      copia.splice(i + 1, 0, { ...a[i], clave: nuevaClave(), articulo: { ...a[i].articulo }, extraIds: [...a[i].extraIds] });
      return copia;
    });

  const quitarArticulo = (clave) => setArticulos((a) => a.filter((x) => x.clave !== clave));

  const vaciar = () => {
    setRenglones([]);
    setArticulos([]);
  };

  const calculado = useMemo(() => {
    const lineas = renglones.map((r) => {
      const c = calcularLineaVenta({
        precioBase: r.presentacion.precio,
        mayoreo: r.presentacion.mayoreo,
        cantidad: r.cantidad,
        tasa: r.producto.tasa,
        incluyeIva,
      });
      return { ...r, ...c, proximoMayoreo: siguienteMayoreo(r.presentacion.mayoreo, r.cantidad) };
    });

    const notas = articulos.map((a) => {
      const base = calcularLineaVenta({ precioBase: a.precio.precio, mayoreo: [], cantidad: 1, tasa: a.servicio.tasa, incluyeIva });
      const extras = a.extraIds
        .map((id) => a.servicio.extras.find((x) => x.id === id))
        .filter(Boolean)
        .map((x) => ({ ...x, ...calcularLineaVenta({ precioBase: x.precio, mayoreo: [], cantidad: 1, tasa: x.tasa, incluyeIva }) }));
      const totalArticulo = Number((base.total + extras.reduce((s, x) => s + x.total, 0)).toFixed(2));
      return { ...a, base, extras, totalArticulo };
    });

    const piezas = [...lineas, ...notas.flatMap((n) => [n.base, ...n.extras])];
    const totales = piezas.length ? totalesVenta(piezas) : { total: 0, subtotal: null, iva: null, desglosado: false };
    const totalServicios = Number(notas.reduce((s, n) => s + n.totalArticulo, 0).toFixed(2));
    const totalProductos = Number((totales.total - totalServicios).toFixed(2));
    return { lineas, notas, totales, totalServicios, totalProductos };
  }, [renglones, articulos, incluyeIva]);

  return {
    ...calculado,
    vacio: renglones.length === 0 && articulos.length === 0,
    tieneServicios: articulos.length > 0,
    agregar,
    poner,
    quitar,
    agregarArticulo,
    editarArticulo,
    duplicarArticulo,
    quitarArticulo,
    vaciar,
  };
}