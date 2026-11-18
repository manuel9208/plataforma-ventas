import { useState } from 'react';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';

const Paso = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="size-7 shrink-0 rounded-full grid place-items-center text-sm font-semibold text-white bg-[var(--c-primario)]">{n}</span>
    <div className="min-w-0 text-sm text-neutral-700">{children}</div>
  </li>
);

// Tarjeta de "siguientes pasos" al terminar el alta. La contraseña se muestra solo esta vez.
export default function ModalEmpresaCreada({ creada, onCerrar }) {
  const { empresa, acceso } = creada;
  const apiUrl = import.meta.env.VITE_API_URL;
  const [copiado, setCopiado] = useState(false);

  const texto = [
    `Empresa: ${empresa.nombre}`,
    `Teléfono: ${acceso.telefono}`,
    `Contraseña temporal: ${acceso.password}`,
    '(Cámbiala al entrar.)',
  ].join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="sm:max-w-xl"
      titulo="Empresa creada"
      onCerrar={onCerrar}
      pie={
        <Boton className="flex-1" onClick={onCerrar}>
          Listo
        </Boton>
      }
    >
      <div className="space-y-5">
        <p className="text-neutral-600">
          <span className="font-semibold text-neutral-900">{empresa.nombre}</span> ya existe, con su sucursal, su caja y su administrador.
        </p>

        <div className="rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] p-4 text-sm space-y-1">
          <p className="font-medium">Acceso del administrador</p>
          <p>Teléfono: {acceso.telefono}</p>
          <p>
            Contraseña temporal: <span className="font-mono font-semibold">{acceso.password}</span>
          </p>
          <p className="text-xs text-amber-700">Anótala ahora: no se vuelve a mostrar.</p>
          <Boton compacto variante="secundario" className="mt-2" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar datos'}
          </Boton>
        </div>

        <div>
          <p className="font-medium mb-3">Siguientes pasos</p>
          <ol className="space-y-3">
            <Paso n={1}>
              Crea un proyecto en Vercel con el mismo repositorio y estas variables:
              <pre className="mt-1 rounded-xl bg-neutral-900 text-neutral-100 text-xs p-3 overflow-x-auto">{`VITE_EMPRESA_SLUG=${empresa.slug}\nVITE_API_URL=${apiUrl}`}</pre>
            </Paso>
            <Paso n={2}>
              Cuando Vercel te dé el dominio, agrégalo aquí en <span className="font-medium">Editar → Dominios del front</span>. Sin eso el navegador no podrá
              conectarse.
            </Paso>
            <Paso n={3}>
              El administrador entra con su teléfono y la contraseña temporal, y el resto del equipo se da de alta desde Empleados.
            </Paso>
          </ol>
        </div>
      </div>
    </Modal>
  );
}