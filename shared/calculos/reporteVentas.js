// Lo que el reporte de ventas ofrece. Lo usan el servidor (validar), la pantalla, el PDF y el Excel: una sola lista.

export const ESTADOS_REPORTE = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'pendientes', etiqueta: 'Con saldo pendiente' },
  { id: 'liquidadas', etiqueta: 'Liquidadas' },
  { id: 'por_entregar', etiqueta: 'Por entregar' },
  { id: 'entregadas', etiqueta: 'Entregadas' },
  { id: 'canceladas', etiqueta: 'Canceladas' },
];

export const GIROS_REPORTE = [
  { id: 'todo', etiqueta: 'Todo' },
  { id: 'servicios', etiqueta: 'Notas de servicio' },
  { id: 'productos', etiqueta: 'Ventas de mostrador' },
];

export const ORDENES_REPORTE = ['fecha', 'total', 'abonado', 'pendiente', 'folio', 'sucursal', 'cliente'];

export const ETIQUETA_ESTADO_NOTA = {
  recibida: 'En espera',
  en_proceso: 'En espera',
  lista: 'Lista para recoger',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
  venta: 'Venta',
};

// tipo: texto | fecha (con hora) | dia (solo fecha) | dinero. suma: la columna se puede totalizar.
// defecto: sale encendida la primera vez. Cada persona elige sus columnas (se guardan en su navegador).
export const COLUMNAS_REPORTE = [
  { id: 'sucursal', etiqueta: 'Sucursal', grupo: 'Datos', tipo: 'texto', defecto: true },
  { id: 'folio', etiqueta: 'Folio', grupo: 'Datos', tipo: 'texto', defecto: true },
  { id: 'fecha', etiqueta: 'Fecha y hora', grupo: 'Datos', tipo: 'fecha', defecto: true },
  { id: 'cliente', etiqueta: 'Cliente', grupo: 'Datos', tipo: 'texto', defecto: true },
  { id: 'telefono', etiqueta: 'Teléfono', grupo: 'Datos', tipo: 'texto' },
  { id: 'cajero', etiqueta: 'Cajero', grupo: 'Datos', tipo: 'texto' },
  { id: 'tipo', etiqueta: 'Tipo', grupo: 'Datos', tipo: 'texto' },
  { id: 'estado', etiqueta: 'Estado', grupo: 'Datos', tipo: 'texto', defecto: true },
  { id: 'articulos', etiqueta: 'Qué consumió', grupo: 'Datos', tipo: 'texto' },
  { id: 'entrega', etiqueta: 'Fecha de entrega', grupo: 'Datos', tipo: 'dia' },
  { id: 'total', etiqueta: 'Total', grupo: 'Dinero', tipo: 'dinero', suma: true, defecto: true },
  { id: 'abonado', etiqueta: 'Abonado', grupo: 'Dinero', tipo: 'dinero', suma: true, defecto: true },
  { id: 'pendiente', etiqueta: 'Pendiente', grupo: 'Dinero', tipo: 'dinero', suma: true, defecto: true },
  { id: 'iva', etiqueta: 'IVA', grupo: 'Dinero', tipo: 'dinero', suma: true },
  { id: 'efectivo', etiqueta: 'Efectivo', grupo: 'Cómo pagaron', tipo: 'dinero', suma: true },
  { id: 'tarjeta', etiqueta: 'Tarjeta', grupo: 'Cómo pagaron', tipo: 'dinero', suma: true },
  { id: 'transferencia', etiqueta: 'Transferencia', grupo: 'Cómo pagaron', tipo: 'dinero', suma: true },
  { id: 'descuentoPromocion', etiqueta: 'Descuento por promoción', grupo: 'Descuentos', tipo: 'dinero', suma: true },
  { id: 'descuentoManual', etiqueta: 'Descuento manual', grupo: 'Descuentos', tipo: 'dinero', suma: true },
  { id: 'puntosUsados', etiqueta: 'Puntos usados', grupo: 'Descuentos', tipo: 'dinero', suma: true },
  { id: 'financiamiento', etiqueta: 'Financiamiento', grupo: 'Descuentos', tipo: 'dinero', suma: true },
];

export const COLUMNAS_POR_DEFECTO = COLUMNAS_REPORTE.filter((c) => c.defecto).map((c) => c.id);