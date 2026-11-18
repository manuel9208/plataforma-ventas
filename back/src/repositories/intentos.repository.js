import { exigirEmpresa } from '../utils/tenant.js';

export async function contarFallos(db, empresaId, usuario, ip, minutos) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT count(*) FILTER (WHERE usuario = $2) AS por_usuario,
            count(*) FILTER (WHERE ip = $3) AS por_ip
     FROM intentos_acceso
     WHERE empresa_id = $1 AND creado_en > now() - make_interval(mins => $4)`,
    [empresaId, usuario, ip || '', minutos]
  );
  return { porUsuario: r.rows[0].por_usuario, porIp: r.rows[0].por_ip };
}

export async function registrarFallo(db, empresaId, usuario, ip) {
  exigirEmpresa(empresaId);
  await db.query(
    `INSERT INTO intentos_acceso (empresa_id, usuario, ip) VALUES ($1, $2, $3)`,
    [empresaId, usuario, ip || '']
  );
}

export async function limpiarFallos(db, empresaId, usuario) {
  exigirEmpresa(empresaId);
  await db.query(
    `DELETE FROM intentos_acceso
     WHERE empresa_id = $1 AND (usuario = $2 OR creado_en < now() - interval '1 day')`,
    [empresaId, usuario]
  );
}