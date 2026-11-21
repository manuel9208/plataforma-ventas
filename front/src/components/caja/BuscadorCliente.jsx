import { useEffect, useState } from 'react';
import { buscarClientes } from '../../services/caja.service.js';
import { formatearTelefono } from '../../utils/formato.js';
import Campo from '../shared/Campo.jsx';
import { vistaCliente } from './vistaCliente.js';

const soloDigitos = (v) => v.replace(/\D/g, '').slice(0, 10);

// Dos campos, teléfono y nombre: al escribir en cualquiera busca clientes.
// onCambio recibe { clienteId } si eligió uno, { clienteNuevo } si escribió ambos datos, o null.
// inicial: { id?, nombre, telefono } para abrir con un cliente ya capturado
export default function BuscadorCliente({ onCambio, inicial = null }) {
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [elegido, setElegido] = useState(inicial?.id ? { id: inicial.id, nombre: inicial.nombre, telefono: inicial.telefono } : null);
  const [resultados, setResultados] = useState([]);

  const buscando = !elegido && (telefono.length >= 3 || nombre.trim().length >= 2);

  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await buscarClientes({
          telefono: telefono.length >= 3 ? telefono : undefined,
          nombre: nombre.trim().length >= 2 ? nombre.trim() : undefined,
          activo: true,
          limite: 5,
        });
        if (vivo) setResultados(r.datos);
      } catch {
        if (vivo) setResultados([]);
      }
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [telefono, nombre, buscando]);

  // onCambio(envio, vista): envio va al servidor; vista es para mostrar al cajero
  const avisar = (tel, nom, cliente) => {
    if (cliente) onCambio({ clienteId: cliente.id }, vistaCliente(cliente));
    else if (tel.length === 10 && nom.trim().length >= 2)
      onCambio({ clienteNuevo: { nombre: nom.trim(), telefono: tel } }, { nombre: nom.trim(), telefono: tel });
    else onCambio(null, null);
  };

  const elegir = (c) => {
    setElegido(c);
    setTelefono(c.telefono);
    setNombre(c.nombre);
    setResultados([]);
    avisar(c.telefono, c.nombre, c);
  };

  const quitar = () => {
    setElegido(null);
    setTelefono('');
    setNombre('');
    setResultados([]);
    onCambio(null, null);
  };

  const escribir = (tel, nom) => {
    setTelefono(tel);
    setNombre(nom);
    avisar(tel, nom, null);
  };

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#faf8f3] border border-[var(--c-borde)] px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{elegido.nombre}</p>
          <p className="text-sm text-neutral-500">{formatearTelefono(elegido.telefono)}</p>
        </div>
        <button type="button" onClick={quitar} className="text-sm font-medium text-[var(--c-primario)]">
          Cambiar
        </button>
      </div>
    );
  }

  const nuevo = telefono.length === 10 && nombre.trim().length >= 2;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Teléfono"
          type="tel"
          inputMode="numeric"
          placeholder="10 dígitos"
          value={telefono}
          onChange={(e) => escribir(soloDigitos(e.target.value), nombre)}
        />
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => escribir(telefono, e.target.value)} />
      </div>

      {resultados.length > 0 && (
        <ul className="rounded-2xl border border-[var(--c-borde)] bg-white divide-y divide-[var(--c-borde)] overflow-hidden">
          {resultados.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => elegir(c)} className="w-full text-left px-4 py-3 min-h-12 hover:bg-[#faf8f3]">
                <span className="font-medium">{c.nombre}</span>
                <span className="text-sm text-neutral-500"> · {formatearTelefono(c.telefono)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nuevo && resultados.length === 0 && (
        <p className="text-xs text-neutral-500">Cliente nuevo: se registrará al cobrar.</p>
      )}
    </div>
  );
}