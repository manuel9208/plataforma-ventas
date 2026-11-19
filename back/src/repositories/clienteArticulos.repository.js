import { exigirEmpresa } from '../utils/tenant.js';

// Artículos activos del cliente, el más reciente primero
export async function listar(db, empresaId, clienteId, limite) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT id, marca, talla, color, modelo, textura, descripcion, ultimos_servicios, veces, ultima_vez
     FROM cliente_articulos
     WHERE empresa_id = $1 AND cliente_id = $2 AND activo
     ORDER BY ultima_vez DESC, id
     LIMIT $3`,
    [empresaId, clienteId, limite]
  );
  return r.rows;
}

// Crea el artículo o, si ya existe (misma clave), lo actualiza y suma una visita
export async function guardar(db, empresaId, clienteId, a) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO cliente_articulos
       (empresa_id, cliente_id, clave, marca, talla, color, modelo, textura, descripcion, ultimos_servicios)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (empresa_id, cliente_id, clave) WHERE activo
     DO UPDATE SET marca = EXCLUDED.marca,
                   talla = EXCLUDED.talla,
                   color = EXCLUDED.color,
                   modelo = EXCLUDED.modelo,
                   textura = EXCLUDED.textura,
                   descripcion = EXCLUDED.descripcion,
                   ultimos_servicios = EXCLUDED.ultimos_servicios,
                   veces = cliente_articulos.veces + 1,
                   ultima_vez = now(),
                   actualizado_en = now()`,
    [
      empresaId,
      clienteId,
      a.clave,
      a.datos.marca,
      a.datos.talla,
      a.datos.color,
      a.datos.modelo,
      a.datos.textura,
      a.datos.descripcion,
      JSON.stringify(a.ultimosServicios),
    ]
  );
}

// Baja lógica: el artículo deja de salir en la lista, pero se conserva con su motivo
export async function darDeBaja(db, empresaId, clienteId, articuloId, { motivo, usuarioId }) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `UPDATE cliente_articulos
     SET activo = FALSE, baja_motivo = $4, baja_en = now(), baja_por = $5, actualizado_en = now()
     WHERE empresa_id = $1 AND cliente_id = $2 AND id = $3 AND activo
     RETURNING marca, talla, color, modelo, textura`,
    [empresaId, clienteId, articuloId, motivo, usuarioId]
  );
  return r.rows[0] || null;
}