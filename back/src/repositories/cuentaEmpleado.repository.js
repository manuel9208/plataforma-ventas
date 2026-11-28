import { exigirEmpresa } from '../utils/tenant.js';

// Los datos de quien tiene la sesión (solo lectura)
export async function obtenerPerfil(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT u.id, u.nombre, u.telefono, u.correo, (u.pin_hash IS NOT NULL) AS tiene_pin, r.nombre AS rol_nombre
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
     WHERE u.empresa_id = $1 AND u.id = $2 AND u.activo`,
    [empresaId, usuarioId]
  );
  return r.rows[0] || null;
}

// Solo para comparar la contraseña actual; nunca sale del servicio
export async function passwordHash(db, empresaId, usuarioId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT password_hash FROM usuarios WHERE empresa_id = $1 AND id = $2 AND activo`,
    [empresaId, usuarioId]
  );
  return r.rows[0]?.password_hash ?? null;
}