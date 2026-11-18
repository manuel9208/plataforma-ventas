import { useState } from 'react';
import * as svc from '../../../services/empresasGlobal.service.js';
import { ZONAS } from '../../../utils/zonasHorarias.js';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const MONEDAS = ['MXN', 'USD'];
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);
const aSlug = (t) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
const aLista = (t) => t.split(/[\n,]/).map((d) => d.trim()).filter(Boolean);

function generarPassword() {
  const b = new Uint32Array(10);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => ALFABETO[n % ALFABETO.length]).join('');
}

const mensaje = (err) => [err.message, ...(err.detalles || []).map((d) => `${d.campo}: ${d.mensaje}`)].join(' · ');

const claseSelect =
  'w-full min-h-12 px-4 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20';

function Seccion({ titulo, children }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-neutral-800 mb-1">{titulo}</legend>
      {children}
    </fieldset>
  );
}

// modo "crear": alta completa. modo "editar": solo nombre, moneda y dominios (el slug y el giro no cambian).
export default function FormularioEmpresa({ modo, empresa, onGuardada, onCerrar }) {
  const editando = modo === 'editar';
  const [f, setF] = useState(() =>
    editando
      ? { nombre: empresa.nombre, moneda: empresa.moneda, dominios: empresa.dominios.join('\n') }
      : {
          nombre: '',
          slug: '',
          slugManual: false,
          tipoNegocio: 'limpieza',
          zonaHoraria: 'America/Mexico_City',
          moneda: 'MXN',
          dominios: '',
          sucursal: '',
          adminNombre: '',
          telefono: '',
          password: generarPassword(),
          pin: '',
        }
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const poner = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const cambiarNombre = (v) => setF((p) => ({ ...p, nombre: v, ...(editando || p.slugManual ? {} : { slug: aSlug(v) }) }));

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    try {
      if (editando) {
        await svc.editar(empresa.id, { nombre: f.nombre.trim(), moneda: f.moneda, dominios: aLista(f.dominios) });
        onGuardada(null);
        return;
      }
      const cuerpo = {
        nombre: f.nombre.trim(),
        slug: f.slug,
        tipoNegocio: f.tipoNegocio,
        zonaHoraria: f.zonaHoraria,
        moneda: f.moneda,
        dominios: aLista(f.dominios),
        sucursal: f.sucursal.trim(),
        admin: { nombre: f.adminNombre.trim(), telefono: f.telefono, password: f.password, pin: f.pin },
      };
      const r = await svc.crear(cuerpo);
      // La contraseña solo se muestra ahora: el servidor no la guarda en claro
      onGuardada({ ...r, acceso: { telefono: f.telefono, password: f.password } });
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  };

  const dominios = (
    <details className="rounded-2xl border border-[var(--c-borde)] px-4 py-3" open={editando}>
      <summary className="cursor-pointer font-medium min-h-8 flex items-center">Dominios del front (opcional)</summary>
      <div className="mt-3">
        <label className="block">
          <span className="block text-sm font-medium text-neutral-600 mb-1.5">Uno por línea</span>
          <textarea
            value={f.dominios}
            onChange={(e) => poner('dominios', e.target.value)}
            rows={3}
            placeholder="app.cliente.com"
            className="w-full px-4 py-3 rounded-xl bg-white border border-[var(--c-borde)] outline-none focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
          />
          <span className="block text-xs text-neutral-500 mt-1">
            Sin esto el navegador del cliente no podrá conectarse. Puedes dejarlo vacío y agregarlo cuando despliegues.
          </span>
        </label>
      </div>
    </details>
  );

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo={editando ? 'Editar empresa' : 'Nueva empresa'}
      onCerrar={enviando ? () => {} : onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-empresa" className="flex-1" cargando={enviando}>
            {editando ? 'Guardar' : 'Crear empresa'}
          </Boton>
        </>
      }
    >
      <form id="form-empresa" onSubmit={enviar} className="space-y-6">
        {editando ? (
          <>
            <p className="text-sm text-neutral-500">
              {empresa.slug} · {empresa.tipoNegocio === 'super' ? 'Súper' : 'Limpieza'}. El slug y el giro no se pueden cambiar.
            </p>
            <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => cambiarNombre(e.target.value)} maxLength={80} required />
            <label className="block">
              <span className="block text-sm font-medium text-neutral-600 mb-1.5">Moneda</span>
              <select value={f.moneda} onChange={(e) => poner('moneda', e.target.value)} className={claseSelect}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-neutral-500 mt-1">Solo se puede cambiar mientras la empresa no tenga ventas.</span>
            </label>
            {dominios}
          </>
        ) : (
          <>
            <Seccion titulo="La empresa">
              <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => cambiarNombre(e.target.value)} maxLength={80} required />
              <Campo
                etiqueta="Slug *"
                value={f.slug}
                onChange={(e) => setF((p) => ({ ...p, slug: aSlug(e.target.value), slugManual: true }))}
                ayuda="Es la clave corta de la empresa (VITE_EMPRESA_SLUG). No se puede cambiar después."
                required
              />
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-1.5">Giro *</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['limpieza', 'Limpieza'],
                    ['super', 'Súper'],
                  ].map(([id, nombre]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => poner('tipoNegocio', id)}
                      className={`min-h-12 rounded-xl text-sm font-semibold transition ${
                        f.tipoNegocio === id
                          ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                          : 'bg-white border border-[var(--c-borde)] text-neutral-600'
                      }`}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-medium text-neutral-600 mb-1.5">Zona horaria</span>
                  <select value={f.zonaHoraria} onChange={(e) => poner('zonaHoraria', e.target.value)} className={claseSelect}>
                    {ZONAS.map(([id, nombre]) => (
                      <option key={id} value={id}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-neutral-600 mb-1.5">Moneda</span>
                  <select value={f.moneda} onChange={(e) => poner('moneda', e.target.value)} className={claseSelect}>
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {dominios}
            </Seccion>

            <Seccion titulo="Primera sucursal">
              <Campo
                etiqueta="Nombre de la sucursal *"
                value={f.sucursal}
                onChange={(e) => poner('sucursal', e.target.value)}
                maxLength={80}
                placeholder="Ej. Centro"
                ayuda="El cliente completará su dirección, teléfono y ubicación en Configuración."
                required
              />
            </Seccion>

            <Seccion titulo="Administrador de la empresa">
              <Campo etiqueta="Nombre *" value={f.adminNombre} onChange={(e) => poner('adminNombre', e.target.value)} maxLength={80} required />
              <Campo
                etiqueta="Teléfono (10 dígitos) *"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={f.telefono}
                onChange={(e) => poner('telefono', soloDigitos(e.target.value, 10))}
                required
              />
              <div>
                <Campo
                  etiqueta="Contraseña genérica *"
                  value={f.password}
                  onChange={(e) => poner('password', e.target.value)}
                  autoComplete="off"
                  ayuda="Mínimo 8 caracteres. El cliente la cambiará."
                  required
                />
                <button
                  type="button"
                  onClick={() => poner('password', generarPassword())}
                  className="mt-2 min-h-10 text-sm font-medium text-[var(--c-primario-2)] underline underline-offset-4"
                >
                  Generar otra
                </button>
              </div>
              <Campo
                etiqueta="PIN (4 dígitos) *"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={f.pin}
                onChange={(e) => poner('pin', soloDigitos(e.target.value, 4))}
                required
              />
            </Seccion>
          </>
        )}
        <MensajeError error={error} />
      </form>
    </Modal>
  );
}