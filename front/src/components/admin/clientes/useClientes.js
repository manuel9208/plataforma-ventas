import { useEffect, useState } from 'react';
import * as svc from '../../../services/clientes.service.js';

export const LIMITE = 10;

export function useClientes() {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('activos'); // activos | inactivos | todos
  const [perfil, setPerfil] = useState('todos'); // todos | completo | incompleto
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(
      async () => {
        try {
          const r = await svc.listar({
            telefono: telefono || undefined,
            nombre: nombre.trim() || undefined,
            pagina,
            limite: LIMITE,
            activo: estado === 'todos' ? undefined : estado === 'activos',
            perfil: perfil === 'todos' ? undefined : perfil,
          });
          if (!vivo) return;
          setDatos(r.datos);
          setTotal(r.total);
          setError('');
        } catch (e) {
          if (vivo) setError(e.message);
        } finally {
          if (vivo) setCargando(false);
        }
      },
      telefono || nombre ? 300 : 0
    );
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [telefono, nombre, pagina, estado, perfil, version]);

  const recargar = () => setVersion((n) => n + 1);
  const reiniciarPagina = (fn) => (v) => {
    fn(v);
    setPagina(1);
  };

  return {
    datos,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / LIMITE)),
    setPagina,
    telefono,
    setTelefono: reiniciarPagina(setTelefono),
    nombre,
    setNombre: reiniciarPagina(setNombre),
    estado,
    setEstado: reiniciarPagina(setEstado),
    perfil,
    setPerfil: reiniciarPagina(setPerfil),
    cargando,
    error,
    crear: async (d) => {
      await svc.crear(d);
      recargar();
    },
    actualizar: async (id, d) => {
      await svc.actualizar(id, d);
      recargar();
    },
    // Devuelve { pin, reemplazo }: el PIN solo existe en esta respuesta
    generarPin: async (id) => {
      const r = await svc.generarPin(id);
      recargar();
      return r;
    },
  };
}