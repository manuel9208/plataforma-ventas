import { exigirEmpresa } from './tenant.js';

// "db" es el pool o el cliente de una transacción.
// Nunca pases aquí contraseñas ni hashes (usa los serializers).
// usuarioId = empleado; adminGlobalId = administrador global.
// entidadId para ids numéricos; entidadUuid para clientes y turnos.
export async function registrarBitacora(db, e) {
  exigirEmpresa(e.empresaId);
  await db.query(
    `INSERT INTO bitacora
       (empresa_id, sucursal_id, usuario_id, admin_global_id, accion, entidad, entidad_id, entidad_uuid, antes, despues, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      e.empresaId,
      e.sucursalId ?? null,
      e.usuarioId ?? null,
      e.adminGlobalId ?? null,
      e.accion,
      e.entidad,
      e.entidadId ?? null,
      e.entidadUuid ?? null,
      e.antes ? JSON.stringify(e.antes) : null,
      e.despues ? JSON.stringify(e.despues) : null,
      e.ip ?? null,
    ]
  );
}