import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { CATALOGO_PERMISOS } from '../../../config/modulosSistema.js';
import { conPantallas, tienePermiso } from '../../../utils/permisos.js';
import { hoyISO } from '../../../utils/formato.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import SelectorPermisos from '../../shared/SelectorPermisos.jsx';

const PERMISO_DATOS = 'empleados.datos_laborales';

const ETIQUETAS = {
  nombre: 'Nombre',
  telefono: 'Teléfono',
  correo: 'Correo',
  password: 'Contraseña',
  pin: 'PIN',
  rolId: 'Rol',
  sucursalIds: 'Sucursales',
  fechaIngreso: 'Fecha de ingreso',
  fechaNacimiento: 'Fecha de nacimiento',
  direccion: 'Dirección',
  contactoEmergenciaNombre: 'Contacto de emergencia',
  contactoEmergenciaTelefono: 'Teléfono de emergencia',
  rfc: 'RFC',
  nss: 'Número de seguro social',
  curp: 'CURP',
};

const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

const Seccion = ({ titulo, children }) => (
  <div className="space-y-4">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 pt-2">{titulo}</h3>
    {children}
  </div>
);

// Al crear, cada rol nace con sus permisos de partida (solo los que quien crea también tiene)
const permisosDeInicio = (rol, actor) =>
  Object.fromEntries(
    CATALOGO_PERMISOS.filter((p) => p.defecto.includes(rol?.clave) && tienePermiso(actor.permisos, p.clave)).map(
      (p) => [p.clave, true]
    )
  );


export default function FormularioEmpleado({ empleado, opciones, onGuardar, onCerrar }) {
  const { usuario: actor } = useAuth();
  const editando = !!empleado;
  const puedeVerDatos = tienePermiso(actor.permisos, PERMISO_DATOS);

  const [f, setF] = useState({
    nombre: empleado?.nombre ?? '',
    telefono: empleado?.telefono ?? '',
    correo: empleado?.correo ?? '',
    password: '',
    pin: '',
    rolId: empleado?.rol.id ?? opciones.roles[0]?.id ?? '',
    sucursalIds: empleado?.sucursalIds ?? (opciones.sucursales.length === 1 ? [opciones.sucursales[0].id] : []),
    permisos: empleado ? { ...empleado.permisos } : permisosDeInicio(opciones.roles[0], actor),
    fechaIngreso: empleado?.fechaIngreso ?? hoyISO(),
    fechaNacimiento: empleado?.fechaNacimiento ?? '',
    direccion: empleado?.direccion ?? '',
    contactoNombre: empleado?.contactoEmergencia?.nombre ?? '',
    contactoTelefono: empleado?.contactoEmergencia?.telefono ?? '',
    rfc: '',
    nss: '',
    curp: '',
  });
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  
  // Al crear, elegir un rol marca sus permisos de partida (se pueden ajustar)
  const cambiarRol = (id) =>
    setF((p) => ({
      ...p,
      rolId: id,
      ...(editando
        ? {}
        : { permisos: permisosDeInicio(opciones.roles.find((r) => String(r.id) === String(id)), actor) }),
    }));

  
  // Solo se muestran (y se envían) los permisos que aplican al rol elegido
  const rolClave = opciones.roles.find((r) => String(r.id) === String(f.rolId))?.clave;
  const permisosDelRol = CATALOGO_PERMISOS.filter((p) => p.roles.includes(rolClave));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    setGuardando(true);
    try {
      const datos = {
        nombre: f.nombre.trim(),
        telefono: f.telefono,
        rolId: Number(f.rolId),
        sucursalIds: f.sucursalIds,
        // Solo los permisos del rol; y quien tiene un permiso de administración recibe también su pantalla
        permisos: conPantallas(
          Object.fromEntries(Object.entries(f.permisos).filter(([k, v]) => v === true && permisosDelRol.some((p) => p.clave === k))),
          permisosDelRol
        ),
        fechaIngreso: f.fechaIngreso,
      };

      // Opcionales: si están llenos se mandan; al editar, vacío = borrar el dato
      const opcionales = {
        correo: f.correo.trim(),
        direccion: f.direccion.trim(),
        fechaNacimiento: f.fechaNacimiento,
        contactoEmergenciaNombre: f.contactoNombre.trim(),
        contactoEmergenciaTelefono: f.contactoTelefono,
      };
      for (const [k, v] of Object.entries(opcionales)) {
        if (v) datos[k] = v;
        else if (editando) datos[k] = null;
      }

      if (f.password) datos.password = f.password;
      if (f.pin) datos.pin = f.pin;
      if (puedeVerDatos) {
        for (const k of ['rfc', 'nss', 'curp']) if (f[k].trim()) datos[k] = f[k].trim();
      }

      await onGuardar(datos);
      onCerrar();
    } catch (err) {
      setError(err.message);
      setDetalles(err.detalles || []);
      setGuardando(false);
    }
  };

  const datosLab = empleado?.datosLaborales;

  return (
    <Modal
      abierto
      titulo={editando ? 'Editar empleado' : 'Nuevo empleado'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-empleado" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-empleado" onSubmit={enviar} className="space-y-6">
        <Seccion titulo="Datos personales">
          <Campo etiqueta="Nombre completo *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          <Campo
            etiqueta="Teléfono *"
            type="tel"
            inputMode="numeric"
            placeholder="10 dígitos"
            value={f.telefono}
            onChange={(e) => set('telefono', soloDigitos(e.target.value, 13))}
            ayuda="Con este teléfono entra al sistema"
            required
          />
          <Campo etiqueta="Correo (opcional)" type="email" value={f.correo} onChange={(e) => set('correo', e.target.value)} autoCapitalize="none" />
          <Campo etiqueta="Fecha de nacimiento (opcional)" type="date" value={f.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} />
          <Campo etiqueta="Dirección (opcional)" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} />
          <Campo etiqueta="Contacto de emergencia (opcional)" value={f.contactoNombre} onChange={(e) => set('contactoNombre', e.target.value)} />
          <Campo
            etiqueta="Teléfono de emergencia (opcional)"
            type="tel"
            inputMode="numeric"
            value={f.contactoTelefono}
            onChange={(e) => set('contactoTelefono', soloDigitos(e.target.value, 13))}
          />
        </Seccion>

        <Seccion titulo="Acceso">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-600 mb-1.5">Rol *</span>
            <select
              value={f.rolId}
              onChange={(e) => cambiarRol(e.target.value)}
              className="w-full min-h-12 px-4 rounded-2xl bg-white border border-neutral-300 text-base outline-none focus:border-[var(--c-primario)]"
              required
            >
              {opciones.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-neutral-600 mb-2">Sucursales *</legend>
            <div className="space-y-2">
              {opciones.sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-3 min-h-11">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--c-primario)]"
                    checked={f.sucursalIds.includes(s.id)}
                    onChange={() => set('sucursalIds', alternar(f.sucursalIds, s.id))}
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          </fieldset>

          <Campo
            etiqueta={editando ? 'Nueva contraseña (opcional)' : 'Contraseña *'}
            type="password"
            value={f.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres"
            required={!editando}
          />
          <Campo
            etiqueta={editando ? 'Nuevo PIN (opcional)' : 'PIN *'}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={f.pin}
            onChange={(e) => set('pin', soloDigitos(e.target.value, 4))}
            autoComplete="off"
            ayuda={editando ? (empleado.tienePin ? 'Déjalo vacío para conservar el actual' : 'Aún no tiene PIN') : '4 dígitos'}
            required={!editando}
          />
          <Campo etiqueta="Fecha de ingreso *" type="date" value={f.fechaIngreso} onChange={(e) => set('fechaIngreso', e.target.value)} required />
        </Seccion>

        {puedeVerDatos && (
          <Seccion titulo="Datos laborales (opcionales)">
            <Campo
              etiqueta="RFC"
              value={f.rfc}
              onChange={(e) => set('rfc', e.target.value.toUpperCase())}
              placeholder={datosLab?.rfc || ''}
              maxLength={13}
              ayuda={editando ? 'Déjalo vacío para no cambiarlo' : undefined}
            />
            <Campo
              etiqueta="Número de seguro social"
              inputMode="numeric"
              value={f.nss}
              onChange={(e) => set('nss', soloDigitos(e.target.value, 11))}
              placeholder={datosLab?.nss || ''}
              ayuda="11 dígitos"
            />
            <Campo
              etiqueta="CURP"
              value={f.curp}
              onChange={(e) => set('curp', e.target.value.toUpperCase())}
              placeholder={datosLab?.curp || ''}
              maxLength={18}
            />
          </Seccion>
        )}

        <Seccion titulo="Permisos">
          <SelectorPermisos
            catalogo={permisosDelRol}
            valor={f.permisos}
            puedeOtorgar={(clave) => tienePermiso(actor.permisos, clave)}
            onCambiar={(v) => set('permisos', v)}
          />
        </Seccion>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <p>{error}</p>
            {detalles.map((d, i) => (
              <p key={i}>
                {ETIQUETAS[d.campo] ?? d.campo}: {d.mensaje}
              </p>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
}