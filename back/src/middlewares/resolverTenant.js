import { buscarPorSlug } from '../repositories/empresas.repository.js';
import { ErrorHttp } from '../utils/errores.js';
import { verificarToken } from '../utils/tokens.js';

// ¿La petición trae un token de administrador global? (autenticar lo verifica de nuevo contra la base)
function traeTokenGlobal(req) {
  const cabecera = req.get('Authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  return Boolean(verificarToken('global', token)?.gid);
}

// El slug es público: solo dice "de qué empresa hablo", no da acceso a nada.
export async function resolverTenant(req, _res, next) {
  try {
    const slug = (req.get('X-Empresa-Slug') || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) throw new ErrorHttp(400, 'Empresa no identificada');

    const empresa = await buscarPorSlug(slug);
    // Mismo mensaje para "no existe" y "inactiva": no revela cuáles empresas existen
    if (!empresa || !empresa.activo) throw new ErrorHttp(404, 'Empresa no encontrada');

    // Suspendida (por falta de pago, por ejemplo): nadie entra, salvo el administrador global
    if (empresa.suspendida && !traeTokenGlobal(req)) throw new ErrorHttp(403, 'Servicio suspendido');

    req.empresa = empresa;
    next();
  } catch (err) {
    next(err);
  }
}