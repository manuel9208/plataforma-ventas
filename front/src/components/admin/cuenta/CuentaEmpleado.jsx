import { useEffect, useState } from 'react';
import * as svc from '../../../services/cuentaEmpleado.service.js';
import { formatearTelefono } from '../../../utils/formato.js';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);
const textoError = (err) => [err.message, ...(err.detalles || []).map((d) => d.mensaje)].join(' · ');

// Estado, aviso y envío de un formulario (lo usan contraseña y PIN)
function useEnvio(inicial) {
  const [f, setF] = useState(inicial);
  const [estado, setEstado] = useState({ error: '', ok: '', guardando: false });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const fallar = (error) => setEstado({ error, ok: '', guardando: false });
  const ejecutar = async (accion, mensajeOk) => {
    setEstado({ error: '', ok: '', guardando: true });
    try {
      await accion();
      setF(inicial);
      setEstado({ error: '', ok: mensajeOk, guardando: false });
    } catch (err) {
      fallar(textoError(err));
    }
  };
  return { f, set, fallar, ejecutar, ...estado };
}

function Tarjeta({ titulo, descripcion, children }) {
  return (
    <section className="rounded-3xl bg-white border border-[var(--c-borde)] p-5 sm:p-6 shadow-[0_14px_30px_-18px_rgba(22,29,51,0.25)]">
      <h3 className="font-semibold tracking-tight text-lg">{titulo}</h3>
      {descripcion && <p className="text-sm text-neutral-500 mt-0.5">{descripcion}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Aviso({ error, ok }) {
  if (error) return <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>;
  if (ok) return <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{ok}</p>;
  return null;
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="py-3 border-b border-[var(--c-borde)] last:border-0">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="font-medium mt-0.5">{valor || '—'}</p>
    </div>
  );
}

function FormPassword() {
  const x = useEnvio({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const enviar = (e) => {
    e.preventDefault();
    if (x.f.passwordNueva !== x.f.confirmar) return x.fallar('Las contraseñas nuevas no coinciden');
    x.ejecutar(
      () => svc.cambiarPassword({ passwordActual: x.f.passwordActual, passwordNueva: x.f.passwordNueva }),
      'Contraseña cambiada'
    );
  };
  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={x.f.passwordActual} onChange={(e) => x.set('passwordActual', e.target.value)} required />
      <Campo etiqueta="Nueva contraseña" type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres" value={x.f.passwordNueva} onChange={(e) => x.set('passwordNueva', e.target.value)} required />
      <Campo etiqueta="Repite la nueva contraseña" type="password" autoComplete="new-password" value={x.f.confirmar} onChange={(e) => x.set('confirmar', e.target.value)} required />
      <Aviso error={x.error} ok={x.ok} />
      <Boton type="submit" cargando={x.guardando} className="w-full">Cambiar contraseña</Boton>
    </form>
  );
}

function FormPin({ onListo }) {
  const x = useEnvio({ passwordActual: '', pin: '', confirmar: '' });
  const enviar = (e) => {
    e.preventDefault();
    if (x.f.pin.length !== 4) return x.fallar('El PIN debe tener 4 números');
    if (x.f.pin !== x.f.confirmar) return x.fallar('Los PIN no coinciden');
    x.ejecutar(async () => {
      await svc.cambiarPin({ passwordActual: x.f.passwordActual, pin: x.f.pin });
      onListo();
    }, 'PIN cambiado');
  };
  const pin = (k) => ({
    type: 'password',
    inputMode: 'numeric',
    autoComplete: 'off',
    value: x.f[k],
    onChange: (e) => x.set(k, soloDigitos(e.target.value, 4)),
    required: true,
  });
  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={x.f.passwordActual} onChange={(e) => x.set('passwordActual', e.target.value)} required />
      <Campo etiqueta="Nuevo PIN (4 números)" {...pin('pin')} />
      <Campo etiqueta="Repite el nuevo PIN" {...pin('confirmar')} />
      <Aviso error={x.error} ok={x.ok} />
      <Boton type="submit" cargando={x.guardando} className="w-full">Cambiar PIN</Boton>
    </form>
  );
}

export default function CuentaEmpleado() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    svc.obtener().then(setD).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <EncabezadoApp titulo="Mi cuenta" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-24">
        {!d ? (
          <p className="text-center text-neutral-400 py-10">{error || 'Cargando…'}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta titulo="Mis datos" descripcion="Si algo está mal, pídele a tu encargado que lo corrija.">
              <Dato etiqueta="Nombre" valor={d.nombre} />
              <Dato etiqueta="Teléfono (con él entras)" valor={formatearTelefono(d.telefono)} />
              <Dato etiqueta="Correo" valor={d.correo} />
              <Dato etiqueta="Puesto" valor={d.rol} />
              <Dato etiqueta="Sucursales" valor={d.sucursales.map((s) => s.nombre).join(', ')} />
            </Tarjeta>
            <Tarjeta titulo="Contraseña" descripcion="La que usas para entrar.">
              <FormPassword />
            </Tarjeta>
            <Tarjeta titulo="PIN" descripcion={d.tienePin ? 'Lo usas para autorizar en la caja.' : 'Aún no tienes PIN. Créalo aquí.'}>
              <FormPin onListo={() => setD((p) => ({ ...p, tienePin: true }))} />
            </Tarjeta>
          </div>
        )}
      </main>
    </>
  );
}