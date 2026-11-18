import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { rutaInicio, tienePermiso } from '../../utils/permisos.js';

export default function RutaProtegida({ rolesPermitidos, permiso, children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/" replace />;

  const destino = rutaInicio(usuario);
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) return <Navigate to={destino} replace />;
  if (permiso && !tienePermiso(usuario.permisos, permiso)) return <Navigate to={destino} replace />;

  return children;
}