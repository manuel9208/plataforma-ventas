import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatearMoneda } from '../../utils/formato.js';
import Boton from '../shared/Boton.jsx';
import ModalRetiro from './ModalRetiro.jsx';

// Avisa cuando la caja junta demasiado efectivo de ventas: por seguridad hay que retirarlo
export default function AvisoRetiro({ retiro, onCrear }) {
  const { empresa } = useAuth();
  const [abierto, setAbierto] = useState(false);
  if (!retiro?.debeRetirar) return null;

  return (
    <>
      <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <p className="font-semibold text-amber-900">Retira {formatearMoneda(retiro.retirar, empresa.moneda)} de la caja</p>
          <p className="text-sm text-amber-800">
            Ya juntaste ese efectivo de ventas. Por seguridad, sácalo de la caja y regístralo.
          </p>
        </div>
        <Boton compacto className="shrink-0" onClick={() => setAbierto(true)}>
          Registrar retiro
        </Boton>
      </div>
      {abierto && <ModalRetiro sugerido={retiro.retirar} onCrear={onCrear} onCerrar={() => setAbierto(false)} />}
    </>
  );
}