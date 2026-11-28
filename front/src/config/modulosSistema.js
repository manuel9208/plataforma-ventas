import { lazy } from 'react';
import { ROLES_ADMIN, ROLES_GESTION, TODOS_LOS_ROLES } from '../utils/permisos.js';

export const MODULOS = [
  {
    id: 'empleados',
    nombre: 'Empleados',
    descripcion: 'Altas, bajas y permisos',
    icono: '👥',
    ruta: '/admin/empleados',
    permiso: 'empleados.gestionar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'empleados.gestionar',
        etiqueta: 'Gestionar empleados',
        roles: ROLES_GESTION,
        defecto: ['administrador', 'gerente'],
      },
      {
        clave: 'empleados.datos_laborales',
        etiqueta: 'Ver y editar RFC, seguro social y CURP',
        roles: ROLES_GESTION,
        defecto: ['administrador'],
      },
    ],
    componente: lazy(() => import('../components/admin/empleados/AdminEmpleados.jsx')),
  },
  {
    id: 'catalogo',
    nombre: 'Catálogo',
    descripcion: 'Departamentos, tipos de artículo e IVA',
    icono: '🗂️',
    ruta: '/admin/catalogo',
    permiso: 'catalogo.gestionar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'catalogo.gestionar',
        etiqueta: 'Gestionar departamentos, tipos de artículo e IVA',
        roles: ROLES_GESTION,
        defecto: ['administrador', 'gerente'],
      },
    ],
    componente: lazy(() => import('../components/admin/catalogo/AdminCatalogo.jsx')),
  },
  {
    id: 'productos',
    nombre: 'Productos',
    descripcion: 'Altas, bajas, precios y presentaciones',
    icono: '📦',
    ruta: '/admin/productos',
    permiso: 'productos.gestionar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'productos.gestionar',
        etiqueta: 'Gestionar productos',
        roles: ROLES_GESTION,
        defecto: ['administrador', 'gerente'],
      },
      {
        clave: 'costos.ver',
        etiqueta: 'Ver y editar costos',
        roles: ROLES_GESTION,
        defecto: ['administrador'],
      },
    ],
    componente: lazy(() => import('../components/admin/productos/AdminProductos.jsx')),
  },
  {
    id: 'servicios',
    nombre: 'Servicios',
    descripcion: 'Precios por artículo y extras',
    icono: '🧼',
    ruta: '/admin/servicios',
    permiso: 'servicios.gestionar',
    giros: ['limpieza'],
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'servicios.gestionar',
        etiqueta: 'Gestionar servicios y extras',
        roles: ROLES_GESTION,
        defecto: ['administrador', 'gerente'],
      },
    ],
    componente: lazy(() => import('../components/admin/servicios/AdminServicios.jsx')),
  },
  {
    id: 'clientes',
    nombre: 'Clientes',
    descripcion: 'Teléfonos, nombres y avisos',
    icono: 'clientes',
    ruta: '/admin/clientes',
    permiso: 'clientes.gestionar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'clientes.gestionar',
        etiqueta: 'Gestionar clientes',
        roles: TODOS_LOS_ROLES,
        defecto: TODOS_LOS_ROLES,
      },
      {
        clave: 'clientes.restablecer_pin',
        etiqueta: 'Restablecer el PIN de un cliente',
        roles: ROLES_GESTION,
        defecto: ['administrador', 'gerente'],
      },
    ],
    componente: lazy(() => import('../components/admin/clientes/AdminClientes.jsx')),
  },
  {
    id: 'cajas',
    nombre: 'Cajas',
    descripcion: 'Cajas, asignaciones y turnos',
    icono: 'cajas',
    ruta: '/admin/cajas',
    permiso: 'caja.administrar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'caja.administrar',
        etiqueta: 'Administrar cajas y turnos',
        roles: ROLES_GESTION,
        defecto: ROLES_GESTION,
      },
    ],
    componente: lazy(() => import('../components/admin/cajas/AdminCajas.jsx')),
  },
  {
    id: 'empresas',
    nombre: 'Empresas',
    descripcion: 'Altas, suspensiones y conexiones',
    icono: 'empresa',
    ruta: '/admin/empresas',
    permiso: null,
    rolesPermitidos: ['adminglobal'],
    permisos: [],
    componente: lazy(() => import('../components/admin/empresas/AdminEmpresas.jsx')),
  },
  {
    id: 'configuracion',
    nombre: 'Configuración',
    descripcion: 'Tu sucursal, ventas, cobro y tickets',
    icono: 'configuracion',
    ruta: '/admin/configuracion',
    permiso: 'configuracion.gestionar',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'configuracion.gestionar',
        etiqueta: 'Cambiar la configuración del negocio y de las sucursales',
        roles: ROLES_GESTION,
        defecto: ROLES_GESTION,
      },
    ],
    componente: lazy(() => import('../components/admin/configuracion/AdminConfiguracion.jsx')),
  },
  {
    id: 'promociones',
    nombre: 'Promociones',
    descripcion: 'Descuentos, happy hour y combos',
    icono: '🏷️',
    ruta: '/admin/promociones',
    permiso: 'promociones.gestionar',
    modulo: 'promociones',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'promociones.gestionar',
        etiqueta: 'Crear y cambiar promociones',
        roles: ROLES_GESTION,
        defecto: ROLES_GESTION,
      },
    ],
    componente: lazy(() => import('../components/admin/promociones/AdminPromociones.jsx')),
  },
  {
    id: 'reportes',
    nombre: 'Reportes',
    descripcion: 'Ventas, cobranza y estadísticas',
    icono: 'reportes',
    ruta: '/admin/reportes',
    permiso: 'reportes.ver',
    rolesPermitidos: ROLES_ADMIN,
    permisos: [
      {
        clave: 'reportes.ver',
        etiqueta: 'Ver los reportes de ventas',
        roles: ROLES_GESTION,
        defecto: ROLES_GESTION,
      },
    ],
    componente: lazy(() => import('../components/admin/reportes/AdminReportes.jsx')),
  },
  {
    id: 'cuenta',
    nombre: 'Mi cuenta',
    descripcion: 'Tus datos y contraseña',
    icono: '🛡️',
    ruta: '/admin/cuenta',
    permiso: null,
    rolesPermitidos: ['adminglobal', ...TODOS_LOS_ROLES],
    // Se muestra aunque no entre a Administración (cajeros, auxiliares…)
    paraTodos: true,
    permisos: [],
    componente: lazy(() => import('../components/admin/cuenta/AdminCuenta.jsx')),
  },
];

export const PERMISOS_PANTALLAS = [
  {
    clave: 'pantalla.admin',
    etiqueta: 'Entrar a Administración',
    grupo: 'Pantallas',
    roles: ROLES_GESTION,
    defecto: ROLES_GESTION,
  },
  {
    clave: 'pantalla.caja',
    etiqueta: 'Entrar a Caja',
    grupo: 'Pantallas',
    roles: TODOS_LOS_ROLES,
    defecto: TODOS_LOS_ROLES,
  },
];

// Permisos que no pertenecen a una pantalla de administración (ej. los de caja)
export const PERMISOS_ADICIONALES = [
  {
    clave: 'notas.cancelar',
    etiqueta: 'Cancelar notas y devolver dinero',
    grupo: 'Caja',
    roles: ROLES_GESTION,
    defecto: ROLES_GESTION,
  },
  {
    clave: 'notas.gestionar',
    etiqueta: 'Ver notas entregadas y canceladas, y cambiar su estado',
    grupo: 'Caja',
    roles: ROLES_GESTION,
    defecto: ['administrador', 'gerente'],
  },
  {
    clave: 'notas.editar',
    etiqueta: 'Corregir datos de una nota (cliente, artículo y fecha)',
    grupo: 'Caja',
    roles: ['administrador', 'gerente', 'jefe'],
    defecto: ['administrador', 'gerente', 'jefe'],
  },
  {
    clave: 'caja.autorizar_entrega',
    etiqueta: 'Autorizar una entrega cuando el cliente no tiene su PIN',
    grupo: 'Caja',
    roles: ['administrador', 'gerente', 'jefe'],
    defecto: ['administrador', 'gerente', 'jefe'],
  },
  {
    clave: 'caja.corte_completo',
    etiqueta: 'Ver el corte de caja completo (cuánto faltó o sobró)',
    grupo: 'Caja',
    roles: ROLES_GESTION,
    defecto: ROLES_GESTION,
  },
  {
    clave: 'caja.descuentos',
    etiqueta: 'Autorizar descuentos manuales en la caja',
    grupo: 'Caja',
    roles: ROLES_GESTION,
    defecto: ROLES_GESTION,
  },
  {
    clave: 'puntos.ajustar',
    etiqueta: 'Regalar o quitar puntos a un cliente',
    grupo: 'Caja',
    roles: ROLES_GESTION,
    defecto: ['administrador', 'gerente'],
  },
  {
    clave: 'caja.financiar',
    etiqueta: 'Financiar una nota (sin anticipo, con cargo por servicio)',
    grupo: 'Caja',
    roles: TODOS_LOS_ROLES,
    defecto: TODOS_LOS_ROLES,
  },
];

// Catálogo único: alimenta el formulario de empleados. El grupo de un módulo es su nombre.
// Los permisos de un módulo de administración necesitan la pantalla de Administración: "requiere" lo marca
export const CATALOGO_PERMISOS = [
  ...PERMISOS_PANTALLAS,
  ...MODULOS.flatMap((m) => m.permisos.map((p) => ({ grupo: m.nombre, defecto: [], requiere: 'pantalla.admin', ...p }))),
  ...PERMISOS_ADICIONALES,
];