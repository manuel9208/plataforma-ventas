import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

// Cada columna sale de esta lista, nunca del usuario. Las fechas salen como texto para no depender de la zona.
const SUCURSAL_IDS = `(SELECT COALESCE(array_agg(ps.sucursal_id ORDER BY ps.sucursal_id), '{}'::bigint[])
                       FROM promocion_sucursales ps WHERE ps.empresa_id = p.empresa_id AND ps.promocion_id = p.id)`;
const COLUMNAS = `p.id, p.nombre, p.tipo, p.modo, p.valor, p.precio_combo, p.lleva, p.paga, p.aplica_a,
  to_char(p.desde, 'YYYY-MM-DD') AS desde, to_char(p.hasta, 'YYYY-MM-DD') AS hasta,
  p.dias, p.hora_desde, p.hora_hasta, p.encendida, p.creado_en, ${SUCURSAL_IDS} AS sucursal_ids`;

// Visible: aplica a todas las sucursales o al menos a una de las del usuario ($2)
const VISIBLE = `AND (
  NOT EXISTS (SELECT 1 FROM promocion_sucursales ps WHERE ps.empresa_id = p.empresa_id AND ps.promocion_id = p.id)
  OR EXISTS (SELECT 1 FROM promocion_sucursales ps WHERE ps.empresa_id = p.empresa_id AND ps.promocion_id = p.id
             AND ps.sucursal_id = ANY($2::bigint[])))`;

export async function listar(db, empresaId, sucursales, { buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro = ` AND p.nombre ILIKE $${params.length}`;
  }
  const donde = `WHERE p.empresa_id = $1 AND p.activo ${VISIBLE}${filtro}`;
  const total = await db.query(`SELECT count(*) AS n FROM promociones p ${donde}`, params);
  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS} FROM promociones p ${donde}
     ORDER BY p.encendida DESC, p.creado_en DESC, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: Number(total.rows[0].n) };
}

// bloquear: dentro de una transacción, para que dos cambios a la vez no se pisen
export async function obtener(db, empresaId, id, { bloquear = false } = {}) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ${COLUMNAS} FROM promociones p WHERE p.empresa_id = $1 AND p.id = $2 AND p.activo${bloquear ? ' FOR UPDATE OF p' : ''}`,
    [empresaId, id]
  );
  return r.rows[0] || null;
}

export async function objetivos(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT o.departamento_id, o.producto_id, o.servicio_id, COALESCE(d.nombre, p.nombre, s.nombre) AS nombre
     FROM promocion_objetivos o
     LEFT JOIN departamentos d ON d.id = o.departamento_id AND d.empresa_id = o.empresa_id
     LEFT JOIN productos p ON p.id = o.producto_id AND p.empresa_id = o.empresa_id
     LEFT JOIN servicios s ON s.id = o.servicio_id AND s.empresa_id = o.empresa_id
     WHERE o.empresa_id = $1 AND o.promocion_id = $2 ORDER BY o.id`,
    [empresaId, id]
  );
  return r.rows;
}

export async function items(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT i.presentacion_id, i.servicio_id, i.tipo_articulo_id, i.cantidad,
            CASE WHEN i.presentacion_id IS NOT NULL
                 THEN CASE WHEN lower(pr.nombre) = lower(pp.nombre) THEN pr.nombre ELSE pr.nombre || ' · ' || pp.nombre END
                 ELSE sv.nombre END AS nombre,
            ta.nombre AS tipo_articulo
     FROM promocion_combo_items i
     LEFT JOIN producto_presentaciones pp ON pp.id = i.presentacion_id AND pp.empresa_id = i.empresa_id
     LEFT JOIN productos pr ON pr.id = pp.producto_id AND pr.empresa_id = pp.empresa_id
     LEFT JOIN servicios sv ON sv.id = i.servicio_id AND sv.empresa_id = i.empresa_id
     LEFT JOIN tipos_articulo ta ON ta.id = i.tipo_articulo_id AND ta.empresa_id = i.empresa_id
     WHERE i.empresa_id = $1 AND i.promocion_id = $2 ORDER BY i.id`,
    [empresaId, id]
  );
  return r.rows;
}

// ---------- Para validar lo que se elige ----------
const TABLAS = { departamento: 'departamentos', producto: 'productos', servicio: 'servicios', tipoArticulo: 'tipos_articulo' };

export async function contarExistentes(db, empresaId, clave, ids) {
  exigirEmpresa(empresaId);
  const tabla = TABLAS[clave];
  if (!tabla) throw new Error('Tabla no permitida');
  const r = await db.query(`SELECT count(*) AS n FROM ${tabla} WHERE empresa_id = $1 AND activo AND id = ANY($2::bigint[])`, [empresaId, ids]);
  return Number(r.rows[0].n);
}

export async function presentaciones(db, empresaId, ids) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT pp.id, pp.unidad
     FROM producto_presentaciones pp
     JOIN productos p ON p.id = pp.producto_id AND p.empresa_id = pp.empresa_id
     WHERE pp.empresa_id = $1 AND pp.activo AND pp.se_vende AND p.activo AND pp.id = ANY($2::bigint[])`,
    [empresaId, ids]
  );
  return r.rows;
}

// ---------- Opciones para el formulario ----------
export async function departamentos(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, nombre FROM departamentos WHERE empresa_id = $1 AND activo ORDER BY codigo`, [empresaId]);
  return r.rows;
}

export async function tiposArticulo(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT id, nombre FROM tipos_articulo WHERE empresa_id = $1 AND activo ORDER BY orden, nombre`, [empresaId]);
  return r.rows;
}

export async function buscarOpciones(db, empresaId, tipo, buscar) {
  exigirEmpresa(empresaId);
  const params = [empresaId];
  if (buscar) params.push(escaparLike(buscar));

  if (tipo === 'producto' || tipo === 'servicio') {
    const tabla = tipo === 'producto' ? 'productos' : 'servicios';
    const filtro = buscar ? ' AND (nombre ILIKE $2 OR sku ILIKE $2)' : '';
    const r = await db.query(`SELECT id, nombre, sku FROM ${tabla} WHERE empresa_id = $1 AND activo${filtro} ORDER BY nombre, id LIMIT 20`, params);
    return r.rows;
  }
  if (tipo === 'presentacion') {
    const filtro = buscar ? ' AND (p.nombre ILIKE $2 OR p.sku ILIKE $2 OR pp.nombre ILIKE $2)' : '';
    const r = await db.query(
      `SELECT pp.id, p.nombre AS producto, pp.nombre AS presentacion, pp.unidad, p.sku
       FROM producto_presentaciones pp
       JOIN productos p ON p.id = pp.producto_id AND p.empresa_id = pp.empresa_id
       WHERE pp.empresa_id = $1 AND pp.activo AND pp.se_vende AND p.activo${filtro}
       ORDER BY p.nombre, pp.id LIMIT 20`,
      params
    );
    return r.rows;
  }
  throw new Error('Tipo no permitido');
}

// ---------- Escritura ----------
export async function insertar(db, empresaId, p, autor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO promociones
       (empresa_id, nombre, tipo, modo, valor, precio_combo, lleva, paga, aplica_a, desde, hasta, dias, hora_desde, hora_hasta,
        creado_por_usuario, creado_por_global)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12::text[], $13, $14, $15, $16)
     RETURNING id`,
    [empresaId, p.nombre, p.tipo, p.modo, p.valor, p.precioCombo, p.lleva, p.paga, p.aplicaA, p.desde, p.hasta, p.dias, p.horaDesde, p.horaHasta, autor.usuarioId, autor.adminGlobalId]
  );
  return r.rows[0].id;
}

// El tipo no se cambia: una promoción de otro tipo se crea nueva
export async function actualizar(db, empresaId, id, p) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE promociones
     SET nombre = $3, modo = $4, valor = $5, precio_combo = $6, lleva = $7, paga = $8, aplica_a = $9,
         desde = $10::date, hasta = $11::date, dias = $12::text[], hora_desde = $13, hora_hasta = $14, actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, id, p.nombre, p.modo, p.valor, p.precioCombo, p.lleva, p.paga, p.aplicaA, p.desde, p.hasta, p.dias, p.horaDesde, p.horaHasta]
  );
}

// Objetivos, artículos del combo y sucursales son configuración: se reemplazan completos.
// Lo ya vendido no se pierde (la venta guarda su propia copia) y el antes y después queda en la bitácora.
export async function reemplazarDetalle(db, empresaId, id, p) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM promocion_objetivos WHERE empresa_id = $1 AND promocion_id = $2`, [empresaId, id]);
  await db.query(`DELETE FROM promocion_combo_items WHERE empresa_id = $1 AND promocion_id = $2`, [empresaId, id]);
  await db.query(`DELETE FROM promocion_sucursales WHERE empresa_id = $1 AND promocion_id = $2`, [empresaId, id]);

  if (p.objetivos.length) {
    const de = (tipo) => p.objetivos.map((o) => (o.tipo === tipo ? o.id : null));
    await db.query(
      `INSERT INTO promocion_objetivos (empresa_id, promocion_id, departamento_id, producto_id, servicio_id)
       SELECT $1, $2, x.d, x.p, x.s FROM unnest($3::bigint[], $4::bigint[], $5::bigint[]) AS x(d, p, s)`,
      [empresaId, id, de('departamento'), de('producto'), de('servicio')]
    );
  }
  if (p.items.length) {
    await db.query(
      `INSERT INTO promocion_combo_items (empresa_id, promocion_id, presentacion_id, servicio_id, tipo_articulo_id, cantidad)
       SELECT $1, $2, x.pr, x.sv, x.ta, x.c FROM unnest($3::bigint[], $4::bigint[], $5::bigint[], $6::int[]) AS x(pr, sv, ta, c)`,
      [empresaId, id, p.items.map((i) => i.presentacionId), p.items.map((i) => i.servicioId), p.items.map((i) => i.tipoArticuloId), p.items.map((i) => i.cantidad)]
    );
  }
  if (p.sucursalIds.length) {
    await db.query(
      `INSERT INTO promocion_sucursales (empresa_id, promocion_id, sucursal_id) SELECT $1, $2, x FROM unnest($3::bigint[]) AS x`,
      [empresaId, id, p.sucursalIds]
    );
  }
}

export async function cambiarEncendida(db, empresaId, id, encendida) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE promociones SET encendida = $3, actualizado_en = now() WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, id, encendida]);
}

export async function darDeBaja(db, empresaId, id, motivo, autor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE promociones
     SET activo = FALSE, encendida = FALSE, baja_motivo = $3, baja_en = now(), baja_por_usuario = $4, baja_por_global = $5, actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, id, motivo, autor.usuarioId, autor.adminGlobalId]
  );
  return r.rowCount > 0;
}

// Promociones encendidas que aplican a una sucursal, con lo necesario para calcular una venta
export async function cargarParaVenta(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT p.id, p.nombre, p.tipo, p.modo, p.valor, p.precio_combo, p.lleva, p.paga, p.aplica_a,
            to_char(p.desde, 'YYYY-MM-DD') AS desde, to_char(p.hasta, 'YYYY-MM-DD') AS hasta,
            p.dias, p.hora_desde, p.hora_hasta, p.encendida,
            (SELECT COALESCE(json_agg(json_build_object(
                      'tipo', CASE WHEN o.departamento_id IS NOT NULL THEN 'departamento' WHEN o.producto_id IS NOT NULL THEN 'producto' ELSE 'servicio' END,
                      'id', COALESCE(o.departamento_id, o.producto_id, o.servicio_id))), '[]'::json)
               FROM promocion_objetivos o WHERE o.empresa_id = p.empresa_id AND o.promocion_id = p.id) AS objetivos,
            (SELECT COALESCE(json_agg(json_build_object(
                      'presentacionId', i.presentacion_id, 'servicioId', i.servicio_id,
                      'tipoArticuloId', i.tipo_articulo_id, 'cantidad', i.cantidad)), '[]'::json)
               FROM promocion_combo_items i WHERE i.empresa_id = p.empresa_id AND i.promocion_id = p.id) AS items
     FROM promociones p
     WHERE p.empresa_id = $1 AND p.activo AND p.encendida
       AND (NOT EXISTS (SELECT 1 FROM promocion_sucursales ps WHERE ps.empresa_id = p.empresa_id AND ps.promocion_id = p.id)
            OR EXISTS (SELECT 1 FROM promocion_sucursales ps WHERE ps.empresa_id = p.empresa_id AND ps.promocion_id = p.id AND ps.sucursal_id = $2))
     ORDER BY p.id`,
    [empresaId, sucursalId]
  );
  return r.rows.map((f) => ({
    id: Number(f.id),
    nombre: f.nombre,
    tipo: f.tipo,
    modo: f.modo,
    valor: f.valor === null ? null : Number(f.valor),
    precioCombo: f.precio_combo === null ? null : Number(f.precio_combo),
    lleva: f.lleva === null ? null : Number(f.lleva),
    paga: f.paga === null ? null : Number(f.paga),
    aplicaA: f.aplica_a,
    desde: f.desde,
    hasta: f.hasta,
    dias: f.dias,
    horaDesde: f.hora_desde,
    horaHasta: f.hora_hasta,
    encendida: f.encendida,
    objetivos: f.objetivos,
    items: f.items,
  }));
}