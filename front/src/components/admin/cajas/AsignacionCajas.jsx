import { useEffect, useState } from 'react';
import * as svc from '../../../services/cajas.service.js';
import { useCajas } from './useCajas.js';
import Selector from '../../shared/Selector.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

export default function AsignacionCajas() {
  const c = useCajas();
  const [eleccion, setEleccion] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null);
  const [version, setVersion] = useState(0);

  const sucursal = eleccion || String(c.sucursales[0]?.id ?? '');

  useEffect(() => {
    if (!sucursal) return;
    let vivo = true;
    setCargando(true);
    svc
      .usuarios(Number(sucursal))
      .then((r) => {
        if (!vivo) return;
        setUsuarios(r);
        setError('');
      })
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [sucursal, version]);

  const cajasActivas = c.cajas.filter((x) => String(x.sucursalId) === sucursal && x.activo);

  // Si el empleado tiene su caja en otra sucursal, también se muestra esa opción
  const opcionesPara = (u) => {
    const actual = u.cajaId && !cajasActivas.some((x) => x.id === u.cajaId) ? c.cajas.find((x) => x.id === u.cajaId) : null;
    return { actual };
  };

  const cambiar = async (u, valor) => {
    setGuardando(u.id);
    setError('');
    try {
      await svc.asignar({ usuarioId: u.id, cajaId: valor === '' ? null : Number(valor) });
      setVersion((n) => n + 1);
      c.recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  };

  return (
    <>
      <p className="mb-4 text-sm text-neutral-500 bg-white rounded-2xl p-4 border border-[var(--c-borde)]">
        Elige la caja de cada empleado. Se usa sola cuando entra al sistema. Varios empleados pueden compartir una caja, pero solo uno a la vez con turno abierto.
      </p>

      {c.sucursales.length > 1 && (
        <div className="mb-4 max-w-sm">
          <Selector etiqueta="Sucursal" value={sucursal} onChange={(e) => setEleccion(e.target.value)}>
            {c.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Selector>
        </div>
      )}

      {(c.error || error) && (
        <div className="mb-4">
          <MensajeError error={c.error || error} />
        </div>
      )}

      {c.cargando || cargando ? (
        <p className="text-center text-neutral-400 py-10">Cargando…</p>
      ) : usuarios.length === 0 ? (
        <p className="text-center text-neutral-400 py-10">No hay empleados para asignar en esta sucursal.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {usuarios.map((u) => {
            const { actual } = opcionesPara(u);
            return (
              <li key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--c-borde)]">
                <p className="font-semibold truncate">{u.nombre}</p>
                <p className="text-sm text-neutral-500 mb-3">{u.rol}</p>
                <Selector
                  etiqueta="Su caja"
                  value={u.cajaId ?? ''}
                  disabled={guardando === u.id}
                  onChange={(e) => cambiar(u, e.target.value)}
                >
                  <option value="">Sin caja</option>
                  {actual && (
                    <option value={actual.id}>
                      {actual.nombre} ({actual.sucursal})
                    </option>
                  )}
                  {cajasActivas.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </Selector>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}