import { exigirEmpresa } from '../utils/tenant.js';

// entidad: 'servicio' | 'extra'. sucursalId vacío = precio general.
export async function registrar(db, empresaId, e) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO historial_precios
       (empresa_id, sucursal_id, entidad, entidad_id, tipo_articulo_id, precio_anterior, precio_nuevo,
        usuario_id, admin_global_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      empresaId,
      e.sucursalId ?? null,
      e.entidad,
      e.entidadId,
      e.tipoArticuloId ?? null,
      e.anterior,
      e.nuevo,
      e.usuarioId ?? null,
      e.adminGlobalId ?? null,
    ]
  );
}