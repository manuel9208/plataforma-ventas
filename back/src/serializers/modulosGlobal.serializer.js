import { costoModulo, moduloVigente, precioDeModulo, totalMensual } from '@plataforma/calculos';

const fechaISO = (v) => (v ? String(v).slice(0, 10) : null);

// Catálogo + lo que tiene la empresa. Esto solo lo ve el administrador global: aquí sí van los precios.
export function modulosDeEmpresa(catalogo, deEmpresa, sucursales, hoy) {
  const porClave = new Map(deEmpresa.map((x) => [x.modulo_clave, x]));
  const modulos = catalogo.map((m) => {
    const x = porClave.get(m.clave);
    const base = {
      clave: m.clave,
      nombre: m.nombre,
      descripcion: m.descripcion,
      cobro: m.cobro,
      esBase: m.es_base,
      precioSugerido: Number(m.precio_sugerido),
      precioPropio: x?.precio_propio === null || x?.precio_propio === undefined ? null : Number(x.precio_propio),
      venceEn: fechaISO(x?.vence_en),
      nota: x?.nota ?? null,
      // El sistema base siempre está encendido
      activo: m.es_base ? true : Boolean(x?.activo),
    };
    const vigente = m.es_base ? true : moduloVigente(base.venceEn, hoy);
    const precio = precioDeModulo(base);
    return {
      ...base,
      vencido: base.activo && !vigente,
      funcionando: base.activo && vigente,
      precio,
      costo: costoModulo({ cobro: base.cobro, precio, sucursales }),
    };
  });
  return {
    modulos,
    sucursales,
    totalMensual: totalMensual(
      modulos.map((m) => ({ activo: m.activo, venceEn: m.esBase ? null : m.venceEn, cobro: m.cobro, precioPropio: m.precioPropio, precioSugerido: m.precioSugerido })),
      sucursales,
      hoy
    ),
  };
}