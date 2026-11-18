import { useState } from 'react';
import EncabezadoApp from '../../shared/EncabezadoApp.jsx';
import GestorEmpresas from './GestorEmpresas.jsx';
import DetalleEmpresa from './DetalleEmpresa.jsx';

// Pantalla solo del administrador global: la lista de empresas y, al tocar "Administrar", su detalle
export default function AdminEmpresas() {
  const [abierta, setAbierta] = useState(null);

  return (
    <>
      <EncabezadoApp titulo="Empresas" atras="/panel" />
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-24">
        {abierta ? <DetalleEmpresa empresa={abierta} onVolver={() => setAbierta(null)} /> : <GestorEmpresas onAdministrar={setAbierta} />}
      </main>
    </>
  );
}