import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { rutaInicio } from '../../utils/permisos.js';
import Boton from '../shared/Boton.jsx';
import { useSucursalPublica } from './useSucursalPublica.js';
import { useCatalogoPublico } from './useCatalogoPublico.js';
import TarjetaCatalogo from './TarjetaCatalogo.jsx';

const CONTENEDOR = 'w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10';

export default function Inicio() {
  const { empresa, usuario } = useAuth();
  const esLimpieza = empresa.tipoNegocio === 'limpieza';
  const [tipo, setTipo] = useState(esLimpieza ? 'servicios' : 'productos');
  const s = useSucursalPublica();
  const c = useCatalogoPublico({ sucursalId: s.sucursalId, tipo });

  const nombreTipo = tipo === 'servicios' ? 'servicios' : 'productos';

  return (
    <div className="min-h-dvh">
      <section className="relative overflow-hidden text-white bg-[linear-gradient(160deg,var(--c-primario-2),var(--c-primario)_65%,#0f1830)]">
        <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-[var(--c-acento)]/15 blur-3xl" />
        <div className={`relative ${CONTENEDOR}`}>
          <div className="h-16 flex items-center justify-between gap-3">
            <span className="font-semibold tracking-tight truncate">{empresa.nombre}</span>
            <Link
              to={usuario ? rutaInicio(usuario) : '/login'}
              className="px-5 py-2.5 rounded-full bg-[var(--c-acento)] text-[#241a05] text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(201,162,92,0.8)] hover:brightness-105 transition"
            >
              {usuario ? 'Mi panel' : 'Iniciar sesión'}
            </Link>
          </div>

          <div className="py-10 sm:py-16 max-w-2xl">
            <p className="text-xs tracking-[0.3em] uppercase text-[var(--c-acento)]">
              {esLimpieza ? 'Servicios y productos' : 'Productos'}
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">{empresa.nombre}</h1>
            <p className="mt-4 text-white/70">Consulta precios y disponibilidad en tu sucursal.</p>

            {s.sucursales.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3">
                <select
                  aria-label="Sucursal"
                  value={s.sucursalId ?? ''}
                  onChange={(e) => s.elegir(Number(e.target.value))}
                  className="min-h-12 px-4 rounded-2xl bg-white/10 border border-white/20 text-white outline-none focus:border-[var(--c-acento)] [&>option]:text-neutral-900"
                >
                  {s.sucursales.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
                {s.sucursales.length > 1 && (
                  <button
                    type="button"
                    onClick={s.usarMiUbicacion}
                    disabled={s.ubicando}
                    className="min-h-12 px-4 rounded-2xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 transition disabled:opacity-60"
                  >
                    {s.ubicando ? 'Buscando…' : 'Usar mi ubicación'}
                  </button>
                )}
              </div>
            )}
            {s.aviso && <p className="mt-3 text-sm text-white/70">{s.aviso}</p>}
          </div>
        </div>
      </section>

      <main className={`${CONTENEDOR} py-8`}>
        {s.cargando ? (
          <p className="text-center text-neutral-400 py-16">Cargando…</p>
        ) : s.error ? (
          <p className="text-center text-neutral-500 py-16">{s.error}</p>
        ) : s.sucursales.length === 0 ? (
          <p className="text-center text-neutral-400 py-16">Pronto tendremos información disponible.</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {esLimpieza && (
                <div className="inline-flex p-1 rounded-2xl bg-white border border-[var(--c-borde)] self-start">
                  {[
                    ['servicios', 'Servicios'],
                    ['productos', 'Productos'],
                  ].map(([id, nombre]) => (
                    <button
                      key={id}
                      onClick={() => setTipo(id)}
                      className={`min-h-10 px-5 rounded-xl text-sm font-semibold transition ${
                        tipo === id
                          ? 'text-white bg-[linear-gradient(180deg,var(--c-primario-2),var(--c-primario))]'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="search"
                value={c.buscar}
                onChange={(e) => c.setBuscar(e.target.value)}
                placeholder={`Buscar entre los ${nombreTipo}`}
                className="flex-1 min-h-12 px-4 rounded-2xl bg-white border border-[var(--c-borde)] outline-none transition focus:border-[var(--c-acento)] focus:ring-4 focus:ring-[var(--c-acento)]/20"
              />
            </div>

            {c.error && <p className="text-center text-red-600 py-6">{c.error}</p>}

            {c.cargando && c.datos.length === 0 ? (
              <p className="text-center text-neutral-400 py-16">Cargando…</p>
            ) : c.datos.length === 0 ? (
              <p className="text-center text-neutral-400 py-16">
                {c.buscar ? `No encontramos "${c.buscar}".` : `Aún no hay ${nombreTipo} en esta sucursal.`}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {c.datos.map((item) => (
                  <TarjetaCatalogo key={item.id} item={item} moneda={empresa.moneda} />
                ))}
              </div>
            )}

            {c.hayMas && (
              <div className="flex justify-center mt-8">
                <Boton variante="secundario" cargando={c.cargando} onClick={c.verMas}>
                  Ver más
                </Boton>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}