import { exigirEmpresa } from '../utils/tenant.js';

const escaparLike = (t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`;

const SUCURSAL_IDS = `(SELECT COALESCE(array_agg(cs.sucursal_id ORDER BY cs.sucursal_id), '{}'::bigint[])
                       FROM cupon_sucursales cs WHERE cs.empresa_id = c.empresa_id AND cs.cupon_id = c.id)`;
const USOS = `(SELECT count(*) FROM cupon_usos u WHERE u.empresa_id = c.empresa_id AND u.cupon_id = c.id AND u.liberado_en IS NULL)`;
const CLIENTES_USADOS = `(SELECT count(DISTINCT u.cliente_id) FROM cupon_usos u WHERE u.empresa_id = c.empresa_id AND u.cupon_id = c.id AND u.liberado_en IS NULL)`;
const COLUMNAS = `c.id, c.nombre, c.codigo, c.modo, c.valor,
  to_char(c.desde, 'YYYY-MM-DD') AS desde, to_char(c.hasta, 'YYYY-MM-DD') AS hasta,
  c.veces_por_cliente, c.max_clientes, c.cliente_id, cl.nombre AS cliente_nombre, c.encendido, c.creado_en,
  ${SUCURSAL_IDS} AS sucursal_ids, ${USOS} AS usos, ${CLIENTES_USADOS} AS clientes_usados`;
const DESDE = `FROM cupones c LEFT JOIN clientes cl ON cl.id = c.cliente_id AND cl.empresa_id = c.empresa_id`;

// Visible: vale en todas las sucursales o en al menos una de las del usuario ($2)
const VISIBLE = `AND (
  NOT EXISTS (SELECT 1 FROM cupon_sucursales cs WHERE cs.empresa_id = c.empresa_id AND cs.cupon_id = c.id)
  OR EXISTS (SELECT 1 FROM cupon_sucursales cs WHERE cs.empresa_id = c.empresa_id AND cs.cupon_id = c.id
             AND cs.sucursal_id = ANY($2::bigint[])))`;

export async function listar(db, empresaId, sucursales, { buscar, limite, pagina }) {
  exigirEmpresa(empresaId);
  const params = [empresaId, sucursales];
  let filtro = '';
  if (buscar) {
    params.push(escaparLike(buscar));
    filtro = ` AND (c.nombre ILIKE $${params.length} OR c.codigo ILIKE $${params.length})`;
  }
  const donde = `WHERE c.empresa_id = $1 AND c.activo ${VISIBLE}${filtro}`;
  const total = await db.query(`SELECT count(*) AS n FROM cupones c ${donde}`, params);
  params.push(limite, (pagina - 1) * limite);
  const filas = await db.query(
    `SELECT ${COLUMNAS} ${DESDE} ${donde}
     ORDER BY c.encendido DESC, c.creado_en DESC, c.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { filas: filas.rows, total: Number(total.rows[0].n) };
}

export async function obtener(db, empresaId, id, { bloquear = false } = {}) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT ${COLUMNAS} ${DESDE} WHERE c.empresa_id = $1 AND c.id = $2 AND c.activo${bloquear ? ' FOR UPDATE OF c' : ''}`,
    [empresaId, id]
  );
  return r.rows[0] || null;
}

export async function existeCodigo(db, empresaId, codigo) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT 1 FROM cupones WHERE empresa_id = $1 AND codigo = $2 AND activo`, [empresaId, codigo]);
  return r.rowCount > 0;
}

export async function insertar(db, empresaId, p, autor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `INSERT INTO cupones
       (empresa_id, nombre, codigo, modo, valor, desde, hasta, veces_por_cliente, max_clientes, cliente_id,
        creado_por_usuario, creado_por_global)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10::uuid, $11, $12)
     RETURNING id`,
    [empresaId, p.nombre, p.codigo, p.modo, p.valor, p.desde, p.hasta, p.vecesPorCliente, p.maxClientes, p.clienteId, autor.usuarioId, autor.adminGlobalId]
  );
  return r.rows[0].id;
}

// El código y el cliente no se cambian: para eso se crea otro cupón
export async function actualizar(db, empresaId, id, p) {
  exigirEmpresa(empresaId);
  await db.query(
    `UPDATE cupones
     SET nombre = $3, modo = $4, valor = $5, desde = $6::date, hasta = $7::date, veces_por_cliente = $8, max_clientes = $9,
         actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, id, p.nombre, p.modo, p.valor, p.desde, p.hasta, p.vecesPorCliente, p.maxClientes]
  );
}

export async function reemplazarSucursales(db, empresaId, id, sucursalIds) {
  exigirEmpresa(empresaId);
  await db.query(`DELETE FROM cupon_sucursales WHERE empresa_id = $1 AND cupon_id = $2`, [empresaId, id]);
  if (sucursalIds.length) {
    await db.query(
      `INSERT INTO cupon_sucursales (empresa_id, cupon_id, sucursal_id) SELECT $1, $2, x FROM unnest($3::bigint[]) AS x`,
      [empresaId, id, sucursalIds]
    );
  }
}

export async function cambiarEncendido(db, empresaId, id, encendido) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE cupones SET encendido = $3, actualizado_en = now() WHERE empresa_id = $1 AND id = $2 AND activo`, [empresaId, id, encendido]);
}

export async function darDeBaja(db, empresaId, id, motivo, autor) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE cupones
     SET activo = FALSE, encendido = FALSE, baja_motivo = $3, baja_en = now(), baja_por_usuario = $4, baja_por_global = $5, actualizado_en = now()
     WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, id, motivo, autor.usuarioId, autor.adminGlobalId]
  );
  return r.rowCount > 0;
}

// ---------- Caja ----------
export async function buscarPorCodigo(db, empresaId, codigo) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS} ${DESDE} WHERE c.empresa_id = $1 AND c.codigo = $2 AND c.activo`, [empresaId, codigo]);
  return r.rows[0] || null;
}

// Dentro de la venta: se bloquea el cupón para que dos cobros a la vez no pasen sus límites
export async function buscarPorId(db, empresaId, id, { bloquear = false } = {}) {
  return obtener(db, empresaId, id, { bloquear });
}

// Usos vigentes (los liberados no cuentan)
export async function usosDe(db, empresaId, cuponId, clienteId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) FILTER (WHERE cliente_id = $3::uuid) AS del_cliente, count(DISTINCT cliente_id) AS clientes
     FROM cupon_usos WHERE empresa_id = $1 AND cupon_id = $2 AND liberado_en IS NULL`,
    [empresaId, cuponId, clienteId]
  );
  return { delCliente: Number(r.rows[0].del_cliente), clientes: Number(r.rows[0].clientes) };
}

export async function insertarUso(db, empresaId, u) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO cupon_usos (empresa_id, cupon_id, cliente_id, venta_id, sucursal_id, descuento, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [empresaId, u.cuponId, u.clienteId, u.ventaId, u.sucursalId, u.descuento, u.usuarioId]
  );
}

// Libera el uso solo si la venta quedó cancelada completa (misma regla que el reporte: cancelado >= total)
export async function liberarDeVenta(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE cupon_usos SET liberado_en = now()
     WHERE empresa_id = $1 AND venta_id = $2 AND liberado_en IS NULL
       AND EXISTS (SELECT 1 FROM ventas v WHERE v.empresa_id = $1 AND v.id = $2 AND v.total > 0 AND v.cancelado >= v.total)`,
    [empresaId, ventaId]
  );
  return r.rowCount;
}

// El cupón que usó una venta (aunque después se haya liberado), para el ticket
export async function usoDeVenta(db, empresaId, ventaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT c.codigo, u.descuento
     FROM cupon_usos u
     JOIN cupones c ON c.id = u.cupon_id AND c.empresa_id = u.empresa_id
     WHERE u.empresa_id = $1 AND u.venta_id = $2`,
    [empresaId, ventaId]
  );
  return r.rows[0] ? { codigo: r.rows[0].codigo, descuento: Number(r.rows[0].descuento) } : null;
}