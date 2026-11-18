import Campo from '../shared/Campo.jsx';
import { soloDigitos } from '../../utils/autorizacion.js';

// Teléfono (si hace falta) y PIN del encargado que autoriza
export default function CamposAutorizacion({ valor, onCambio, puedeAutorizar }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
      <div>
        <p className="font-medium">Autorización</p>
        <p className="text-sm text-neutral-600">
          {puedeAutorizar
            ? 'Tú puedes autorizar: escribe tu PIN de empleado.'
            : 'Pide a un gerente o administrador que escriba su teléfono y su PIN.'}
        </p>
      </div>
      {!puedeAutorizar && (
        <Campo
          etiqueta="Teléfono del encargado *"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={valor.telefono}
          onChange={(e) => onCambio({ ...valor, telefono: soloDigitos(e.target.value, 10) })}
          placeholder="10 dígitos"
        />
      )}
      <Campo
        etiqueta={puedeAutorizar ? 'Tu PIN de empleado *' : 'PIN del encargado *'}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={valor.pin}
        onChange={(e) => onCambio({ ...valor, pin: soloDigitos(e.target.value, 4) })}
        placeholder="4 dígitos"
      />
    </div>
  );
}