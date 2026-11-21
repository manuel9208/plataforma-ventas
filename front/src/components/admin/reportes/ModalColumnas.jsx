import Modal from '../../shared/Modal.jsx';
import Boton from '../../shared/Boton.jsx';

export default function ModalColumnas({ disponibles, ids, onAlternar, onRestablecer, onCerrar }) {
  const grupos = [...new Set(disponibles.map((c) => c.grupo))];
  const activas = disponibles.filter((c) => ids.includes(c.id)).length;

  return (
    <Modal
      abierto
      titulo="Columnas de la tabla"
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" className="flex-1" onClick={onRestablecer}>
            Las de siempre
          </Boton>
          <Boton className="flex-1" onClick={onCerrar}>
            Listo
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-neutral-500">Elige qué columnas quieres ver. Se guardan en este navegador.</p>
        {grupos.map((g) => (
          <fieldset key={g}>
            <legend className="text-sm font-medium text-neutral-600 mb-1">{g}</legend>
            <div className="space-y-0.5">
              {disponibles
                .filter((c) => c.grupo === g)
                .map((c) => {
                  const marcada = ids.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 min-h-11">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--c-primario)]"
                        checked={marcada}
                        disabled={marcada && activas === 1}
                        onChange={() => onAlternar(c.id)}
                      />
                      <span>{c.etiqueta}</span>
                    </label>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}