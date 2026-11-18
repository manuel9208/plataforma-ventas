import { useState } from 'react';
import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';
import Campo from '../../shared/Campo.jsx';
import Interruptor from '../../shared/Interruptor.jsx';
import Plegable from '../../shared/Plegable.jsx';
import MensajeError from '../../shared/MensajeError.jsx';

const ETIQUETAS = { nombre: 'Nombre', telefono: 'Teléfono', correo: 'Correo', notas: 'Notas' };
const soloDigitos = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function FormularioCliente({ cliente, onGuardar, onCerrar }) {
  const editando = !!cliente;
  const [f, setF] = useState(() => ({
    nombre: cliente?.nombre ?? '',
    telefono: cliente?.telefono ?? '',
    correo: cliente?.correo ?? '',
    notas: cliente?.notas ?? '',
    aceptaWhatsapp: cliente?.aceptaWhatsapp ?? false,
  }));
  const [error, setError] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setDetalles([]);
    setGuardando(true);
    try {
      const datos = { nombre: f.nombre.trim(), telefono: f.telefono, aceptaWhatsapp: f.aceptaWhatsapp };
      // Opcionales: al crear se omiten si están vacíos; al editar, vacío borra el dato
      for (const [clave, valor] of [['correo', f.correo.trim()], ['notas', f.notas.trim()]]) {
        if (valor) datos[clave] = valor;
        else if (editando) datos[clave] = null;
      }
      await onGuardar(datos);
      onCerrar();
    } catch (err) {
      setError(err.message);
      setDetalles(err.detalles || []);
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-cliente" className="flex-1" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-cliente" onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Teléfono *" type="tel" inputMode="numeric" placeholder="10 dígitos" value={f.telefono} onChange={(e) => set('telefono', soloDigitos(e.target.value, 13))} required />
        <Campo etiqueta="Nombre *" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required />
        <Interruptor
          etiqueta="Acepta avisos por WhatsApp"
          descripcion="Enciéndelo solo si el cliente aceptó recibirlos. Se guarda la fecha en que aceptó."
          valor={f.aceptaWhatsapp}
          onCambiar={(v) => set('aceptaWhatsapp', v)}
        />
        <Plegable titulo="Más datos" abiertaInicial={!!(f.correo || f.notas)}>
          <Campo etiqueta="Correo (opcional)" type="email" value={f.correo} onChange={(e) => set('correo', e.target.value)} autoCapitalize="none" />
          <Campo etiqueta="Notas (opcional)" value={f.notas} onChange={(e) => set('notas', e.target.value)} />
        </Plegable>
        <MensajeError error={error} detalles={detalles} etiquetas={ETIQUETAS} />
      </form>
    </Modal>
  );
}