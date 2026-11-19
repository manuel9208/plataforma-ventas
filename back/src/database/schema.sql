-- ============ BLOQUE 1: EMPRESAS Y SUCURSALES ============
CREATE TABLE IF NOT EXISTS empresas (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  tipo_negocio TEXT NOT NULL,
  zona_horaria TEXT NOT NULL,
  moneda TEXT NOT NULL,
  dominios_permitidos TEXT[] NOT NULL DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sucursales (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  direccion TEXT,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  zona_horaria TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (nombre, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_sucursales_empresa ON sucursales(empresa_id);

-- ============ BLOQUE 2: ROLES Y USUARIOS ============
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  clave TEXT NOT NULL,
  nombre TEXT NOT NULL,
  nivel_jerarquico INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (id, empresa_id),
  UNIQUE (clave, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_empresa ON roles(empresa_id);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  rol_id BIGINT NOT NULL,
  permisos JSONB NOT NULL DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (usuario, empresa_id),
  FOREIGN KEY (rol_id, empresa_id) REFERENCES roles(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);

CREATE TABLE IF NOT EXISTS usuario_sucursales (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  PRIMARY KEY (usuario_id, sucursal_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_empresa ON usuario_sucursales(empresa_id);

-- ============ BLOQUE 3: VARIABLES POR EMPRESA Y SUCURSAL ============
CREATE TABLE IF NOT EXISTS catalogo_variables (
  clave TEXT PRIMARY KEY,
  grupo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  es_secreto BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS variables_empresa (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  clave TEXT NOT NULL REFERENCES catalogo_variables(clave),
  valor_cifrado TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, clave)
);

CREATE TABLE IF NOT EXISTS variables_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  clave TEXT NOT NULL REFERENCES catalogo_variables(clave),
  valor_cifrado TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sucursal_id, clave),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_variables_sucursal_empresa ON variables_sucursal(empresa_id);

INSERT INTO catalogo_variables (clave, grupo, descripcion, es_secreto) VALUES
  ('cloudinary_cloud_name', 'cloudinary', 'Nombre de la nube de Cloudinary', FALSE),
  ('cloudinary_api_key', 'cloudinary', 'API key de Cloudinary', TRUE),
  ('cloudinary_api_secret', 'cloudinary', 'API secret de Cloudinary', TRUE),
  ('ia_proveedor', 'ia', 'Proveedor de IA (por ejemplo openai o anthropic)', FALSE),
  ('ia_api_key', 'ia', 'API key del proveedor de IA', TRUE),
  ('meta_whatsapp_token', 'meta', 'Token de acceso de WhatsApp Business (Meta)', TRUE),
  ('meta_whatsapp_phone_id', 'meta', 'ID del número de WhatsApp Business', FALSE),
  ('meta_webhook_secret', 'meta', 'Secreto para validar webhooks de Meta', TRUE)
ON CONFLICT (clave) DO NOTHING;

-- ============ BLOQUE 4: INTENTOS DE ACCESO Y BITACORA ============
CREATE TABLE IF NOT EXISTS intentos_acceso (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intentos_usuario ON intentos_acceso(empresa_id, usuario, creado_en);

CREATE INDEX IF NOT EXISTS idx_intentos_ip ON intentos_acceso(empresa_id, ip, creado_en);

CREATE TABLE IF NOT EXISTS bitacora (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT,
  usuario_id BIGINT,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id BIGINT,
  antes JSONB,
  despues JSONB,
  ip TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_empresa ON bitacora(empresa_id, creado_en DESC);

-- ============ BLOQUE 5: DATOS DE EMPLEADOS Y ACCESO POR TELEFONO ============
ALTER TABLE usuarios ALTER COLUMN usuario DROP NOT NULL;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS correo TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_telefono ON usuarios (telefono, empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_correo ON usuarios (lower(correo), empresa_id) WHERE correo IS NOT NULL;

CREATE TABLE IF NOT EXISTS empleados_datos (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario_id BIGINT NOT NULL,
  rfc_cifrado TEXT,
  nss_cifrado TEXT,
  curp_cifrado TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_empleados_datos_empresa ON empleados_datos(empresa_id);

-- ============ BLOQUE 6: ROL JEFE ============
UPDATE roles r SET nivel_jerarquico = 5
WHERE r.clave = 'auxiliar' AND r.nivel_jerarquico = 4
  AND NOT EXISTS (SELECT 1 FROM roles j WHERE j.empresa_id = r.empresa_id AND j.clave = 'jefe');

UPDATE roles r SET nivel_jerarquico = 4
WHERE r.clave = 'cajero' AND r.nivel_jerarquico = 3
  AND NOT EXISTS (SELECT 1 FROM roles j WHERE j.empresa_id = r.empresa_id AND j.clave = 'jefe');

INSERT INTO roles (empresa_id, clave, nombre, nivel_jerarquico)
SELECT id, 'jefe', 'Jefe', 3 FROM empresas
ON CONFLICT (clave, empresa_id) DO NOTHING;

-- ============ BLOQUE 7: ADMIN GLOBAL ============
CREATE TABLE IF NOT EXISTS admins_globales (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bitacora ADD COLUMN IF NOT EXISTS admin_global_id BIGINT REFERENCES admins_globales(id);

-- ============ BLOQUE 8: CATALOGO (PRODUCTOS Y SERVICIOS) ============
CREATE TABLE IF NOT EXISTS departamentos (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL CHECK (codigo ~ '^[0-9]{2}$'),
  nombre TEXT NOT NULL,
  siguiente_consecutivo INTEGER NOT NULL DEFAULT 1 CHECK (siguiente_consecutivo BETWEEN 1 AND 10000),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (codigo, empresa_id),
  UNIQUE (nombre, empresa_id)
);

CREATE TABLE IF NOT EXISTS tasas_iva (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  es_defecto BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (nombre, empresa_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tasas_iva_defecto ON tasas_iva (empresa_id) WHERE es_defecto;

CREATE TABLE IF NOT EXISTS tipos_articulo (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (nombre, empresa_id)
);

CREATE TABLE IF NOT EXISTS empresa_config (
  empresa_id BIGINT PRIMARY KEY REFERENCES empresas(id),
  precios_incluyen_iva BOOLEAN NOT NULL DEFAULT TRUE,
  permitir_venta_sin_existencia BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO empresa_config (empresa_id) SELECT id FROM empresas ON CONFLICT DO NOTHING;

INSERT INTO tasas_iva (empresa_id, nombre, porcentaje, es_defecto)
SELECT e.id, v.nombre, v.porcentaje, v.es_defecto
FROM empresas e
CROSS JOIN (VALUES ('General', 16::numeric, TRUE), ('Tasa 0', 0::numeric, FALSE)) AS v(nombre, porcentaje, es_defecto)
WHERE NOT EXISTS (SELECT 1 FROM tasas_iva t WHERE t.empresa_id = e.id);

CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sku TEXT NOT NULL CHECK (sku ~ '^[0-9]{6}$'),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  marca TEXT,
  departamento_id BIGINT NOT NULL,
  tasa_iva_id BIGINT NOT NULL,
  unidad_base TEXT NOT NULL,
  costo_ultimo NUMERIC(14,6),
  costo_promedio NUMERIC(14,6),
  merma_esperada_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (merma_esperada_pct >= 0 AND merma_esperada_pct <= 100),
  controla_inventario BOOLEAN NOT NULL DEFAULT TRUE,
  lleva_caducidad BOOLEAN NOT NULL DEFAULT FALSE,
  foto_url TEXT,
  foto_public_id TEXT,
  visible_publico BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  baja_en TIMESTAMPTZ,
  baja_motivo TEXT,
  baja_por BIGINT,
  creado_por BIGINT,
  actualizado_por BIGINT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (sku, empresa_id),
  FOREIGN KEY (departamento_id, empresa_id) REFERENCES departamentos(id, empresa_id),
  FOREIGN KEY (tasa_iva_id, empresa_id) REFERENCES tasas_iva(id, empresa_id),
  FOREIGN KEY (creado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (actualizado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (baja_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_productos_lista ON productos (empresa_id, activo, nombre);

CREATE INDEX IF NOT EXISTS idx_productos_departamento ON productos (empresa_id, departamento_id);

CREATE INDEX IF NOT EXISTS idx_productos_sync ON productos (empresa_id, actualizado_en);

CREATE TABLE IF NOT EXISTS producto_presentaciones (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  producto_id BIGINT NOT NULL,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL,
  factor NUMERIC(14,6) NOT NULL CHECK (factor > 0),
  precio NUMERIC(12,2) CHECK (precio >= 0),
  se_vende BOOLEAN NOT NULL DEFAULT TRUE,
  se_compra BOOLEAN NOT NULL DEFAULT FALSE,
  es_base BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (producto_id, nombre),
  CHECK (NOT es_base OR factor = 1),
  CHECK (NOT se_vende OR precio IS NOT NULL),
  FOREIGN KEY (producto_id, empresa_id) REFERENCES productos(id, empresa_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_presentacion_base ON producto_presentaciones (producto_id) WHERE es_base;

CREATE INDEX IF NOT EXISTS idx_presentaciones_empresa ON producto_presentaciones (empresa_id, producto_id);

CREATE TABLE IF NOT EXISTS codigos_barras (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  presentacion_id BIGINT NOT NULL,
  codigo TEXT NOT NULL,
  es_interno BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codigo, empresa_id),
  FOREIGN KEY (presentacion_id, empresa_id) REFERENCES producto_presentaciones(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_codigos_presentacion ON codigos_barras (empresa_id, presentacion_id);

CREATE TABLE IF NOT EXISTS producto_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  producto_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  stock_minimo NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  punto_reorden NUMERIC(14,4) CHECK (punto_reorden >= 0),
  ubicacion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (producto_id, sucursal_id),
  FOREIGN KEY (producto_id, empresa_id) REFERENCES productos(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_sucursal_empresa ON producto_sucursal (empresa_id, sucursal_id);

CREATE TABLE IF NOT EXISTS presentacion_precio_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  presentacion_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (presentacion_id, sucursal_id),
  FOREIGN KEY (presentacion_id, empresa_id) REFERENCES producto_presentaciones(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_presentacion_precio_empresa ON presentacion_precio_sucursal (empresa_id, sucursal_id);

CREATE TABLE IF NOT EXISTS servicios (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sku TEXT NOT NULL CHECK (sku ~ '^[0-9]{6}$'),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  departamento_id BIGINT NOT NULL,
  tasa_iva_id BIGINT NOT NULL,
  tiempo_estimado_horas INTEGER CHECK (tiempo_estimado_horas >= 0),
  foto_url TEXT,
  foto_public_id TEXT,
  visible_publico BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  baja_en TIMESTAMPTZ,
  baja_motivo TEXT,
  baja_por BIGINT,
  creado_por BIGINT,
  actualizado_por BIGINT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (sku, empresa_id),
  FOREIGN KEY (departamento_id, empresa_id) REFERENCES departamentos(id, empresa_id),
  FOREIGN KEY (tasa_iva_id, empresa_id) REFERENCES tasas_iva(id, empresa_id),
  FOREIGN KEY (creado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (actualizado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (baja_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_servicios_lista ON servicios (empresa_id, activo, nombre);

CREATE INDEX IF NOT EXISTS idx_servicios_departamento ON servicios (empresa_id, departamento_id);

CREATE INDEX IF NOT EXISTS idx_servicios_sync ON servicios (empresa_id, actualizado_en);

CREATE TABLE IF NOT EXISTS servicio_precios (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  servicio_id BIGINT NOT NULL,
  tipo_articulo_id BIGINT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (servicio_id, tipo_articulo_id),
  FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
  FOREIGN KEY (tipo_articulo_id, empresa_id) REFERENCES tipos_articulo(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_servicio_precios_empresa ON servicio_precios (empresa_id);

CREATE TABLE IF NOT EXISTS servicio_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  servicio_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (servicio_id, sucursal_id),
  FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_servicio_sucursal_empresa ON servicio_sucursal (empresa_id, sucursal_id);

CREATE TABLE IF NOT EXISTS servicio_precio_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  servicio_id BIGINT NOT NULL,
  tipo_articulo_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (servicio_id, tipo_articulo_id, sucursal_id),
  FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
  FOREIGN KEY (tipo_articulo_id, empresa_id) REFERENCES tipos_articulo(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_servicio_precio_suc_empresa ON servicio_precio_sucursal (empresa_id, sucursal_id);

CREATE TABLE IF NOT EXISTS extras (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  tasa_iva_id BIGINT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (nombre, empresa_id),
  FOREIGN KEY (tasa_iva_id, empresa_id) REFERENCES tasas_iva(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_extras_empresa ON extras (empresa_id, activo);

CREATE TABLE IF NOT EXISTS servicio_extras (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  servicio_id BIGINT NOT NULL,
  extra_id BIGINT NOT NULL,
  PRIMARY KEY (servicio_id, extra_id),
  FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
  FOREIGN KEY (extra_id, empresa_id) REFERENCES extras(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_servicio_extras_empresa ON servicio_extras (empresa_id);

CREATE TABLE IF NOT EXISTS extra_precio_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  extra_id BIGINT NOT NULL,
  sucursal_id BIGINT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (extra_id, sucursal_id),
  FOREIGN KEY (extra_id, empresa_id) REFERENCES extras(id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_extra_precio_suc_empresa ON extra_precio_sucursal (empresa_id, sucursal_id);

CREATE TABLE IF NOT EXISTS historial_precios (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT,
  entidad TEXT NOT NULL CHECK (entidad IN ('presentacion', 'servicio', 'extra')),
  entidad_id BIGINT NOT NULL,
  tipo_articulo_id BIGINT,
  precio_anterior NUMERIC(12,2),
  precio_nuevo NUMERIC(12,2) NOT NULL,
  usuario_id BIGINT,
  admin_global_id BIGINT REFERENCES admins_globales(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_historial_precios ON historial_precios (empresa_id, entidad, entidad_id, creado_en DESC);

-- ============ BLOQUE 9: NOMBRES UNICOS SIN IMPORTAR MAYUSCULAS ============
CREATE UNIQUE INDEX IF NOT EXISTS uq_departamentos_nombre_ci ON departamentos (empresa_id, lower(nombre));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_articulo_nombre_ci ON tipos_articulo (empresa_id, lower(nombre));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tasas_iva_nombre_ci ON tasas_iva (empresa_id, lower(nombre));

-- ============ BLOQUE 10: PRECIOS DE MAYOREO ============
CREATE TABLE IF NOT EXISTS presentacion_precios_volumen (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  presentacion_id BIGINT NOT NULL,
  cantidad_minima NUMERIC(14,4) NOT NULL CHECK (cantidad_minima > 0),
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  PRIMARY KEY (presentacion_id, cantidad_minima),
  FOREIGN KEY (presentacion_id, empresa_id) REFERENCES producto_presentaciones(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_precios_volumen_empresa ON presentacion_precios_volumen (empresa_id);

-- ============ BLOQUE 11: CLIENTES, CAJAS Y TURNOS ============
ALTER TABLE bitacora ADD COLUMN IF NOT EXISTS entidad_uuid UUID;

CREATE TABLE IF NOT EXISTS clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL CHECK (telefono ~ '^[0-9]{10}$'),
  correo TEXT,
  notas TEXT,
  acepta_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  consentimiento_whatsapp_en TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por BIGINT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  UNIQUE (telefono, empresa_id),
  FOREIGN KEY (creado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa_nombre ON clientes (empresa_id, lower(nombre));

CREATE TABLE IF NOT EXISTS cajas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id),
  UNIQUE (id, sucursal_id, empresa_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cajas_nombre ON cajas (empresa_id, sucursal_id, lower(nombre));

CREATE TABLE IF NOT EXISTS caja_usuarios (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  usuario_id BIGINT NOT NULL,
  caja_id BIGINT NOT NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (caja_id, empresa_id) REFERENCES cajas(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_caja_usuarios_caja ON caja_usuarios (empresa_id, caja_id);

CREATE TABLE IF NOT EXISTS turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  fondo_inicial NUMERIC(12,2) NOT NULL CHECK (fondo_inicial >= 0),
  fecha_operativa DATE NOT NULL,
  abierto_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en TIMESTAMPTZ,
  cerrado_por BIGINT,
  cerrado_por_global BIGINT REFERENCES admins_globales(id),
  cierre_tardio BOOLEAN NOT NULL DEFAULT FALSE,
  efectivo_contado NUMERIC(12,2),
  entregado_duenos NUMERIC(12,2),
  dejado_manana NUMERIC(12,2),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (cerrado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto_caja ON turnos (caja_id) WHERE cerrado_en IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto_usuario ON turnos (usuario_id) WHERE cerrado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_turnos_sucursal ON turnos (empresa_id, sucursal_id, abierto_en DESC);

CREATE TABLE IF NOT EXISTS sucursal_config (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  pin_entrega_activo BOOLEAN NOT NULL DEFAULT TRUE,
  fotos_obligatorias BOOLEAN NOT NULL DEFAULT FALSE,
  almacenaje_dias_espera INTEGER CHECK (almacenaje_dias_espera >= 0),
  almacenaje_cobro NUMERIC(12,2) CHECK (almacenaje_cobro >= 0),
  almacenaje_modo TEXT NOT NULL DEFAULT 'por_dia' CHECK (almacenaje_modo IN ('por_dia', 'fijo')),
  garantia_dias INTEGER CHECK (garantia_dias >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sucursal_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

INSERT INTO sucursal_config (empresa_id, sucursal_id) SELECT empresa_id, id FROM sucursales ON CONFLICT DO NOTHING;

INSERT INTO cajas (empresa_id, sucursal_id, nombre)
SELECT s.empresa_id, s.id, 'Caja 1' FROM sucursales s
WHERE NOT EXISTS (SELECT 1 FROM cajas c WHERE c.empresa_id = s.empresa_id AND c.sucursal_id = s.id);

-- ============ BLOQUE 12: VENTAS, PARTIDAS, PAGOS Y FOLIOS ============
ALTER TABLE sucursal_config ADD COLUMN IF NOT EXISTS prefijo_folio TEXT CHECK (prefijo_folio ~ '^[A-Z0-9]{2,6}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_sucursal_prefijo ON sucursal_config (empresa_id, prefijo_folio) WHERE prefijo_folio IS NOT NULL;

CREATE TABLE IF NOT EXISTS folios_sucursal (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  ultimo_numero BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (sucursal_id),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE TABLE IF NOT EXISTS ventas (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  folio TEXT NOT NULL,
  folio_numero BIGINT NOT NULL,
  caja_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  usuario_id BIGINT NOT NULL,
  cliente_id UUID,
  origen TEXT NOT NULL DEFAULT 'mostrador' CHECK (origen IN ('mostrador', 'en_linea', 'domicilio')),
  precios_incluyen_iva BOOLEAN NOT NULL,
  subtotal NUMERIC(12,2),
  iva NUMERIC(12,2),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  UNIQUE (sucursal_id, folio_numero),
  FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_sucursal_fecha ON ventas (empresa_id, sucursal_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas (empresa_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas (turno_id);

CREATE TABLE IF NOT EXISTS venta_partidas (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'producto' CHECK (tipo IN ('producto', 'servicio', 'extra', 'cargo')),
  producto_id BIGINT,
  presentacion_id BIGINT,
  nombre TEXT NOT NULL,
  sku TEXT,
  unidad TEXT,
  factor NUMERIC(14,6),
  cantidad NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  cantidad_base NUMERIC(14,4),
  precio_lista NUMERIC(12,2) NOT NULL,
  precio_aplicado NUMERIC(12,2) NOT NULL,
  origen_precio TEXT NOT NULL CHECK (origen_precio IN ('general', 'sucursal', 'mayoreo')),
  tasa_iva NUMERIC(5,2) NOT NULL,
  base NUMERIC(12,2),
  iva NUMERIC(12,2),
  total NUMERIC(12,2) NOT NULL,
  costo NUMERIC(14,6),
  entregado_en TIMESTAMPTZ,
  entregado_por BIGINT,
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  UNIQUE (venta_id, orden),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (producto_id, empresa_id) REFERENCES productos(id, empresa_id),
  FOREIGN KEY (presentacion_id, empresa_id) REFERENCES producto_presentaciones(id, empresa_id),
  FOREIGN KEY (entregado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_partidas_venta ON venta_partidas (empresa_id, venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_partidas_producto ON venta_partidas (empresa_id, producto_id);

CREATE TABLE IF NOT EXISTS venta_pagos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  forma TEXT NOT NULL CHECK (forma IN ('efectivo', 'tarjeta', 'transferencia')),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  recibido NUMERIC(12,2) NOT NULL,
  cambio NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cambio >= 0),
  referencia TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, empresa_id) REFERENCES cajas(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos (empresa_id, venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_pagos_turno ON venta_pagos (turno_id, forma);

-- ============ BLOQUE 13: NOTAS DE SERVICIO ============
ALTER TABLE empresa_config
  ADD COLUMN IF NOT EXISTS abono_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (abono_porcentaje >= 0 AND abono_porcentaje <= 100),
  ADD COLUMN IF NOT EXISTS abono_es_minimo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campos_articulo JSONB NOT NULL DEFAULT '{"marca":"obligatorio","talla":"obligatorio","color":"obligatorio","modelo":"opcional","textura":"opcional","descripcion":"opcional"}';

ALTER TABLE sucursal_config
  ADD COLUMN IF NOT EXISTS abono_porcentaje NUMERIC(5,2) CHECK (abono_porcentaje >= 0 AND abono_porcentaje <= 100),
  ADD COLUMN IF NOT EXISTS abono_es_minimo BOOLEAN,
  ADD COLUMN IF NOT EXISTS campos_articulo JSONB;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS pin_entrega_hash TEXT,
  ADD COLUMN IF NOT EXISTS tiene_servicios BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE venta_partidas ADD COLUMN IF NOT EXISTS cargo_regla JSONB;

CREATE TABLE IF NOT EXISTS partida_servicio (
  partida_id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  servicio_id BIGINT NOT NULL,
  tipo_articulo_id BIGINT NOT NULL,
  tipo_articulo_nombre TEXT NOT NULL,
  estado_trabajo TEXT NOT NULL DEFAULT 'recibido' CHECK (estado_trabajo IN ('recibido', 'en_proceso', 'listo', 'entregado', 'cancelado')),
  fecha_prometida DATE NOT NULL,
  fecha_prometida_original DATE NOT NULL,
  recibido_por BIGINT,
  trabajado_por BIGINT,
  sucursal_entrega_id BIGINT,
  PRIMARY KEY (partida_id),
  FOREIGN KEY (partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id),
  FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
  FOREIGN KEY (tipo_articulo_id, empresa_id) REFERENCES tipos_articulo(id, empresa_id),
  FOREIGN KEY (recibido_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (trabajado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (sucursal_entrega_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_servicio_estado ON partida_servicio (empresa_id, estado_trabajo, fecha_prometida);

CREATE TABLE IF NOT EXISTS partida_articulos (
  partida_id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  marca TEXT,
  talla TEXT,
  color TEXT,
  modelo TEXT,
  textura TEXT,
  descripcion TEXT,
  PRIMARY KEY (partida_id),
  FOREIGN KEY (partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_articulos_marca ON partida_articulos (empresa_id, lower(marca));

CREATE INDEX IF NOT EXISTS idx_partida_articulos_talla ON partida_articulos (empresa_id, lower(talla));

CREATE INDEX IF NOT EXISTS idx_partida_articulos_color ON partida_articulos (empresa_id, lower(color));

CREATE INDEX IF NOT EXISTS idx_partida_articulos_modelo ON partida_articulos (empresa_id, lower(modelo));

CREATE INDEX IF NOT EXISTS idx_partida_articulos_textura ON partida_articulos (empresa_id, lower(textura));

CREATE TABLE IF NOT EXISTS partida_extra (
  partida_id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  padre_partida_id UUID NOT NULL,
  extra_id BIGINT NOT NULL,
  PRIMARY KEY (partida_id),
  FOREIGN KEY (partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id),
  FOREIGN KEY (padre_partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id),
  FOREIGN KEY (extra_id, empresa_id) REFERENCES extras(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_extra_padre ON partida_extra (empresa_id, padre_partida_id);

-- ============ BLOQUE 14: ABONO OBLIGATORIO POR DEFECTO EN EMPRESAS NUEVAS ============
ALTER TABLE empresa_config ALTER COLUMN abono_es_minimo SET DEFAULT TRUE;

-- ============ BLOQUE 15: NOTAS (COBRO DE SALDO, ESTADOS Y PIE DEL TICKET) ============
ALTER TABLE venta_pagos ADD COLUMN IF NOT EXISTS cobro_id UUID;

CREATE TABLE IF NOT EXISTS venta_cobros (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  usuario_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_cobros_venta ON venta_cobros (empresa_id, venta_id);

ALTER TABLE partida_servicio
  ADD COLUMN IF NOT EXISTS listo_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listo_por BIGINT,
  ADD COLUMN IF NOT EXISTS aviso_listo_enviado_en TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS partida_estado_historial (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  partida_id UUID NOT NULL,
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  usuario_id BIGINT,
  admin_global_id BIGINT REFERENCES admins_globales(id),
  motivo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_historial ON partida_estado_historial (empresa_id, partida_id, creado_en);

CREATE INDEX IF NOT EXISTS idx_ventas_notas ON ventas (empresa_id, sucursal_id, creado_en DESC) WHERE tiene_servicios;

ALTER TABLE empresa_config
  ADD COLUMN IF NOT EXISTS pie_ticket_recepcion TEXT CHECK (char_length(pie_ticket_recepcion) <= 600),
  ADD COLUMN IF NOT EXISTS pie_ticket_entrega TEXT CHECK (char_length(pie_ticket_entrega) <= 600);

ALTER TABLE sucursal_config
  ADD COLUMN IF NOT EXISTS pie_ticket_recepcion TEXT CHECK (char_length(pie_ticket_recepcion) <= 600),
  ADD COLUMN IF NOT EXISTS pie_ticket_entrega TEXT CHECK (char_length(pie_ticket_entrega) <= 600);

  -- ============ BLOQUE 16: ENTREGA DE NOTAS ============
CREATE TABLE IF NOT EXISTS venta_entregas (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  sucursal_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  metodo TEXT NOT NULL CHECK (metodo IN ('pin', 'autorizacion', 'sin_pin')),
  autorizado_por BIGINT,
  recoge_nombre TEXT CHECK (char_length(recoge_nombre) <= 80),
  motivo TEXT CHECK (char_length(motivo) <= 200),
  articulos INTEGER NOT NULL CHECK (articulos > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (autorizado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_entregas_venta ON venta_entregas (empresa_id, venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_entregas_sucursal ON venta_entregas (empresa_id, sucursal_id, creado_en DESC);

ALTER TABLE partida_servicio ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES venta_entregas(id);

CREATE INDEX IF NOT EXISTS idx_partida_servicio_entrega ON partida_servicio (empresa_id, entrega_id) WHERE entrega_id IS NOT NULL;

-- ============ BLOQUE 16: ENTREGA DE NOTAS ============
CREATE TABLE IF NOT EXISTS venta_entregas (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  sucursal_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  metodo TEXT NOT NULL CHECK (metodo IN ('pin', 'autorizacion', 'sin_pin')),
  autorizado_por BIGINT,
  recoge_nombre TEXT CHECK (char_length(recoge_nombre) <= 80),
  motivo TEXT CHECK (char_length(motivo) <= 200),
  articulos INTEGER NOT NULL CHECK (articulos > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (autorizado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_entregas_venta ON venta_entregas (empresa_id, venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_entregas_sucursal ON venta_entregas (empresa_id, sucursal_id, creado_en DESC);

ALTER TABLE partida_servicio ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES venta_entregas(id);

CREATE INDEX IF NOT EXISTS idx_partida_servicio_entrega ON partida_servicio (empresa_id, entrega_id) WHERE entrega_id IS NOT NULL;

-- ============ BLOQUE 17: CANCELACIONES Y REEMBOLSOS ============
CREATE TABLE IF NOT EXISTS venta_ajustes (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  venta_id UUID NOT NULL,
  sucursal_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cancelacion', 'reembolso')),
  autorizado_por BIGINT NOT NULL,
  motivo TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 3 AND 200),
  valor_cancelado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_cancelado >= 0),
  tope NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tope >= 0),
  devuelto NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (devuelto >= 0),
  retenido NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (retenido >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (autorizado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_ajustes_venta ON venta_ajustes (empresa_id, venta_id);

CREATE TABLE IF NOT EXISTS venta_reembolsos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  ajuste_id UUID NOT NULL,
  venta_id UUID NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  forma TEXT NOT NULL CHECK (forma IN ('efectivo', 'tarjeta', 'transferencia')),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  referencia TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  FOREIGN KEY (ajuste_id, empresa_id) REFERENCES venta_ajustes(id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, empresa_id) REFERENCES cajas(id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_reembolsos_venta ON venta_reembolsos (empresa_id, venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_reembolsos_turno ON venta_reembolsos (turno_id, forma);

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cancelado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cancelado >= 0),
  ADD COLUMN IF NOT EXISTS ajustado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (ajustado >= 0),
  ADD COLUMN IF NOT EXISTS retenido NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (retenido >= 0),
  ADD COLUMN IF NOT EXISTS reembolsado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reembolsado >= 0);

ALTER TABLE venta_partidas ADD COLUMN IF NOT EXISTS ajuste_id UUID REFERENCES venta_ajustes(id);

CREATE INDEX IF NOT EXISTS idx_venta_partidas_ajuste ON venta_partidas (empresa_id, ajuste_id) WHERE ajuste_id IS NOT NULL;

-- ============ BLOQUE 18: GASTOS, RETIROS Y CORTE DE CAJA ============
ALTER TABLE empresa_config ADD COLUMN IF NOT EXISTS efectivo_dejar_caja NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (efectivo_dejar_caja >= 0);

ALTER TABLE sucursal_config ADD COLUMN IF NOT EXISTS efectivo_dejar_caja NUMERIC(12,2) CHECK (efectivo_dejar_caja >= 0);

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  turno_id UUID NOT NULL,
  caja_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'retiro')),
  categoria TEXT CHECK (categoria IN ('proveedor', 'insumos', 'servicios', 'otro')),
  concepto TEXT NOT NULL CHECK (char_length(concepto) BETWEEN 3 AND 120),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  recibe_nombre TEXT CHECK (char_length(recibe_nombre) <= 80),
  referencia TEXT CHECK (char_length(referencia) <= 60),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado_en TIMESTAMPTZ,
  anulado_por BIGINT,
  anulado_autorizado_por BIGINT,
  anulado_motivo TEXT CHECK (char_length(anulado_motivo) <= 200),
  PRIMARY KEY (id),
  UNIQUE (id, empresa_id),
  CHECK ((tipo = 'gasto' AND categoria IS NOT NULL AND recibe_nombre IS NULL) OR (tipo = 'retiro' AND categoria IS NULL AND recibe_nombre IS NOT NULL)),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id),
  FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (anulado_por, empresa_id) REFERENCES usuarios(id, empresa_id),
  FOREIGN KEY (anulado_autorizado_por, empresa_id) REFERENCES usuarios(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_caja_movimientos_turno ON caja_movimientos (empresa_id, turno_id, tipo) WHERE anulado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_caja_movimientos_sucursal ON caja_movimientos (empresa_id, sucursal_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS turno_cortes (
  turno_id UUID NOT NULL,
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  sucursal_id BIGINT NOT NULL,
  caja_id BIGINT NOT NULL,
  sin_conteo BOOLEAN NOT NULL DEFAULT FALSE,
  fondo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  cobros_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  cobros_tarjeta NUMERIC(12,2) NOT NULL DEFAULT 0,
  cobros_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  reembolsos_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  reembolsos_tarjeta NUMERIC(12,2) NOT NULL DEFAULT 0,
  reembolsos_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  gastos NUMERIC(12,2) NOT NULL DEFAULT 0,
  retiros NUMERIC(12,2) NOT NULL DEFAULT 0,
  esperado NUMERIC(12,2) NOT NULL,
  contado NUMERIC(12,2),
  diferencia NUMERIC(12,2),
  dejado NUMERIC(12,2),
  entregado NUMERIC(12,2),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (turno_id),
  FOREIGN KEY (turno_id, empresa_id) REFERENCES turnos(id, empresa_id),
  FOREIGN KEY (caja_id, sucursal_id, empresa_id) REFERENCES cajas(id, sucursal_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_turno_cortes_sucursal ON turno_cortes (empresa_id, sucursal_id, creado_en DESC);

-- ============ BLOQUE 19: AVISO DE RETIRO DE EFECTIVO ============
ALTER TABLE empresa_config ADD COLUMN IF NOT EXISTS retiro_efectivo_limite NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (retiro_efectivo_limite >= 0);

ALTER TABLE sucursal_config ADD COLUMN IF NOT EXISTS retiro_efectivo_limite NUMERIC(12,2) CHECK (retiro_efectivo_limite >= 0);

-- ============ BLOQUE 20: DEVOLUCIONES DE VENTAS DE MOSTRADOR (POR CANTIDAD) ============
ALTER TABLE venta_partidas ADD COLUMN IF NOT EXISTS cantidad_devuelta NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0 AND cantidad_devuelta <= cantidad);

ALTER TABLE venta_partidas ADD COLUMN IF NOT EXISTS valor_devuelto NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_devuelto >= 0 AND valor_devuelto <= total);

CREATE TABLE IF NOT EXISTS venta_devoluciones (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  ajuste_id UUID NOT NULL,
  venta_id UUID NOT NULL,
  partida_id UUID NOT NULL,
  cantidad NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  PRIMARY KEY (id),
  FOREIGN KEY (ajuste_id, empresa_id) REFERENCES venta_ajustes(id, empresa_id),
  FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id),
  FOREIGN KEY (partida_id, empresa_id) REFERENCES venta_partidas(id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_venta_devoluciones_ajuste ON venta_devoluciones (empresa_id, ajuste_id);

CREATE INDEX IF NOT EXISTS idx_venta_devoluciones_venta ON venta_devoluciones (empresa_id, venta_id);

-- ============ BLOQUE 21: SUSPENSION DE EMPRESAS ============
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS suspendida BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_motivo TEXT CHECK (char_length(suspension_motivo) <= 200),
  ADD COLUMN IF NOT EXISTS suspendida_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspendida_por_global BIGINT REFERENCES admins_globales(id);

  -- ============ BLOQUE 22: BAJA DE SUCURSALES ============
ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS baja_motivo TEXT CHECK (char_length(baja_motivo) <= 200),
  ADD COLUMN IF NOT EXISTS baja_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baja_por_global BIGINT REFERENCES admins_globales(id);

  -- ============ BLOQUE 23: MODULOS CON COSTO ============
CREATE TABLE IF NOT EXISTS catalogo_modulos (
  clave TEXT PRIMARY KEY CHECK (clave ~ '^[a-z0-9_]{3,40}$'),
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  cobro TEXT NOT NULL DEFAULT 'empresa' CHECK (cobro IN ('empresa', 'sucursal')),
  precio_sugerido NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_sugerido >= 0),
  es_base BOOLEAN NOT NULL DEFAULT FALSE,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS empresa_modulos (
  empresa_id BIGINT NOT NULL REFERENCES empresas(id),
  modulo_clave TEXT NOT NULL REFERENCES catalogo_modulos(clave),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  precio_propio NUMERIC(12,2) CHECK (precio_propio >= 0),
  vence_en DATE,
  nota TEXT CHECK (char_length(nota) <= 200),
  actualizado_por_global BIGINT REFERENCES admins_globales(id),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, modulo_clave)
);

CREATE INDEX IF NOT EXISTS idx_empresa_modulos_empresa ON empresa_modulos (empresa_id);

-- Para agregar un módulo nuevo: UNA fila aquí (clave, nombre, descripción, cobro, precio sugerido, es_base, orden)
INSERT INTO catalogo_modulos (clave, nombre, descripcion, cobro, precio_sugerido, es_base, orden) VALUES
  ('sistema_base', 'Sistema base', 'Caja, notas, clientes, catálogo, cortes y empleados', 'empresa', 0, TRUE, 1),
  ('whatsapp_avisos', 'Avisos por WhatsApp', 'Mensajes al cliente: recibido, listo, entregado y PIN perdido', 'sucursal', 0, FALSE, 2),
  ('whatsapp_ia', 'IA en WhatsApp', 'Atención automática a clientes con inteligencia artificial', 'empresa', 0, FALSE, 3),
  ('correo', 'Correo electrónico', 'Envío de avisos y PIN por correo', 'empresa', 0, FALSE, 4),
  ('push', 'Notificaciones push', 'Avisos en el celular del cliente', 'empresa', 0, FALSE, 5),
  ('pedidos_en_linea', 'Pedidos en línea', 'Pedidos desde la portada pública y a domicilio', 'sucursal', 0, FALSE, 6),
  ('fotos_articulos', 'Fotos de artículos', 'Fotos del estado al recibir y fotos de productos y servicios', 'empresa', 0, FALSE, 7)
ON CONFLICT (clave) DO NOTHING;

-- ============ BLOQUE 24: CONEXIONES Y LLAVES (CATALOGO DINAMICO) ============
ALTER TABLE catalogo_variables
  ADD COLUMN IF NOT EXISTS etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'numero', 'opcion')),
  ADD COLUMN IF NOT EXISTS opciones TEXT[],
  ADD COLUMN IF NOT EXISTS defecto TEXT,
  ADD COLUMN IF NOT EXISTS visible_si TEXT;

CREATE TABLE IF NOT EXISTS catalogo_variable_grupos (
  grupo TEXT PRIMARY KEY CHECK (grupo ~ '^[a-z0-9_]{2,30}$'),
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  ayuda TEXT,
  nivel TEXT NOT NULL DEFAULT 'empresa' CHECK (nivel IN ('empresa', 'ambos')),
  selector_clave TEXT REFERENCES catalogo_variables(clave),
  modulo TEXT REFERENCES catalogo_modulos(clave),
  orden INTEGER NOT NULL DEFAULT 0
);

-- Para agregar una llave nueva: UNA fila aquí. Para un servicio nuevo: una fila en catalogo_variable_grupos y sus llaves.
INSERT INTO catalogo_variables (clave, grupo, descripcion, es_secreto, etiqueta, orden, tipo, opciones, defecto, visible_si) VALUES
  ('cloudinary_cloud_name', 'cloudinary', 'Nombre de la nube de Cloudinary', FALSE, 'Nombre de la nube', 1, 'texto', NULL, NULL, NULL),
  ('cloudinary_api_key', 'cloudinary', 'API key de Cloudinary', TRUE, 'API key', 2, 'texto', NULL, NULL, NULL),
  ('cloudinary_api_secret', 'cloudinary', 'API secret de Cloudinary', TRUE, 'API secret', 3, 'texto', NULL, NULL, NULL),
  ('ia_proveedor', 'ia', 'Proveedor de IA (por ejemplo openai o anthropic)', FALSE, 'Proveedor', 1, 'texto', NULL, NULL, NULL),
  ('ia_api_key', 'ia', 'API key del proveedor de IA', TRUE, 'Llave de acceso', 2, 'texto', NULL, NULL, NULL),
  ('whatsapp_proveedor', 'whatsapp', 'Proveedor de WhatsApp', FALSE, 'Proveedor', 1, 'opcion', ARRAY['baileys:Baileys (no oficial)', 'meta:Meta oficial', 'dialog360:360dialog'], 'baileys', NULL),
  ('meta_whatsapp_token', 'whatsapp', 'Token de acceso de WhatsApp Business (Meta)', TRUE, 'Token de acceso', 2, 'texto', NULL, NULL, 'meta'),
  ('meta_whatsapp_phone_id', 'whatsapp', 'ID del número de WhatsApp Business', FALSE, 'ID del número', 3, 'texto', NULL, NULL, 'meta'),
  ('meta_webhook_secret', 'whatsapp', 'Secreto para validar webhooks de Meta', TRUE, 'Secreto del webhook', 4, 'texto', NULL, NULL, 'meta'),
  ('dialog360_api_key', 'whatsapp', 'Llave de acceso de 360dialog', TRUE, 'Llave de acceso', 2, 'texto', NULL, NULL, 'dialog360'),
  ('dialog360_numero', 'whatsapp', 'Número de WhatsApp en 360dialog', FALSE, 'Número', 3, 'texto', NULL, NULL, 'dialog360'),
  ('smtp_host', 'correo', 'Servidor de correo (SMTP)', FALSE, 'Servidor', 1, 'texto', NULL, NULL, NULL),
  ('smtp_puerto', 'correo', 'Puerto del servidor de correo', FALSE, 'Puerto', 2, 'numero', NULL, NULL, NULL),
  ('smtp_usuario', 'correo', 'Usuario del correo', FALSE, 'Usuario', 3, 'texto', NULL, NULL, NULL),
  ('smtp_password', 'correo', 'Contraseña del correo', TRUE, 'Contraseña', 4, 'texto', NULL, NULL, NULL),
  ('smtp_remitente', 'correo', 'Dirección que aparece como remitente', FALSE, 'Remitente', 5, 'texto', NULL, NULL, NULL),
  ('push_vapid_public', 'push', 'Llave pública de avisos push (VAPID)', FALSE, 'Llave pública', 1, 'texto', NULL, NULL, NULL),
  ('push_vapid_private', 'push', 'Llave privada de avisos push (VAPID)', TRUE, 'Llave privada', 2, 'texto', NULL, NULL, NULL),
  ('push_vapid_subject', 'push', 'Correo de contacto de avisos push', FALSE, 'Correo de contacto', 3, 'texto', NULL, NULL, NULL)
ON CONFLICT (clave) DO UPDATE SET
  grupo = EXCLUDED.grupo, descripcion = EXCLUDED.descripcion, etiqueta = EXCLUDED.etiqueta, orden = EXCLUDED.orden,
  tipo = EXCLUDED.tipo, opciones = EXCLUDED.opciones, defecto = EXCLUDED.defecto, visible_si = EXCLUDED.visible_si;

INSERT INTO catalogo_variable_grupos (grupo, nombre, descripcion, ayuda, nivel, selector_clave, modulo, orden) VALUES
  ('cloudinary', 'Fotos (Cloudinary)', 'Fotos de productos, servicios y artículos recibidos', NULL, 'empresa', NULL, 'fotos_articulos', 1),
  ('ia', 'Inteligencia artificial', 'Atención automática a clientes en WhatsApp', NULL, 'empresa', NULL, 'whatsapp_ia', 2),
  ('whatsapp', 'WhatsApp', 'Avisos al cliente: recibido, listo, entregado y PIN perdido', 'Baileys no usa llaves: el cliente escanea un código QR en Configuración. Meta y 360dialog piden las llaves de abajo.', 'ambos', 'whatsapp_proveedor', 'whatsapp_avisos', 3),
  ('correo', 'Correo (SMTP)', 'Envío de avisos y PIN por correo', NULL, 'ambos', NULL, 'correo', 4),
  ('push', 'Avisos push', 'Notificaciones en el celular del cliente', 'Son dos llaves (pública y privada) y un correo de contacto.', 'empresa', NULL, 'push', 5)
ON CONFLICT (grupo) DO UPDATE SET
  nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, ayuda = EXCLUDED.ayuda,
  selector_clave = EXCLUDED.selector_clave, modulo = EXCLUDED.modulo, orden = EXCLUDED.orden;


  -- ============ BLOQUE 25: CONFIGURACION DEL CLIENTE ============
ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS telefono TEXT CHECK (telefono ~ '^[0-9]{10}$'),
  ADD COLUMN IF NOT EXISTS es_principal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sucursal_principal ON sucursales (empresa_id) WHERE es_principal;

UPDATE sucursales SET es_principal = TRUE
WHERE id IN (SELECT DISTINCT ON (empresa_id) id FROM sucursales WHERE activo ORDER BY empresa_id, id)
  AND NOT EXISTS (SELECT 1 FROM sucursales x WHERE x.empresa_id = sucursales.empresa_id AND x.es_principal);

ALTER TABLE empresa_config
  ADD COLUMN IF NOT EXISTS vende_productos BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS vende_servicios BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS vista_inicial TEXT NOT NULL DEFAULT 'servicios' CHECK (vista_inicial IN ('servicios', 'productos'));

ALTER TABLE sucursal_config
  ADD COLUMN IF NOT EXISTS vende_productos BOOLEAN,
  ADD COLUMN IF NOT EXISTS vende_servicios BOOLEAN,
  ADD COLUMN IF NOT EXISTS vista_inicial TEXT CHECK (vista_inicial IN ('servicios', 'productos'));

ALTER TABLE empresa_config ALTER COLUMN pie_ticket_recepcion SET DEFAULT E'Gracias por su preferencia\n{sucursal}\nTel. {telefono_sucursal}';

ALTER TABLE empresa_config ALTER COLUMN pie_ticket_entrega SET DEFAULT E'Gracias por su preferencia\n{sucursal}\nTel. {telefono_sucursal}';

-- ============ BLOQUE 26: CONFIGURACION, PASO 2 (PIN DE ENTREGA POR EMPRESA) ============
ALTER TABLE empresa_config
ADD COLUMN IF NOT EXISTS pin_entrega_activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sucursal_config ALTER COLUMN pin_entrega_activo DROP NOT NULL;
ALTER TABLE sucursal_config ALTER COLUMN pin_entrega_activo DROP DEFAULT;

-- ============ BLOQUE 27: INFORMACION DE LA SUCURSAL (CONTACTO, REDES Y HORARIO) ============
ALTER TABLE sucursales
ADD COLUMN IF NOT EXISTS referencias TEXT CHECK (char_length(referencias) <= 300),
ADD COLUMN IF NOT EXISTS mapa_url TEXT CHECK (char_length(mapa_url) <= 300);
ALTER TABLE empresa_config
ADD COLUMN IF NOT EXISTS contacto_whatsapp TEXT CHECK (contacto_whatsapp ~ '^([0-9]{10})?$'),
ADD COLUMN IF NOT EXISTS contacto_correo TEXT CHECK (char_length(contacto_correo) <= 120),
ADD COLUMN IF NOT EXISTS red_facebook TEXT CHECK (char_length(red_facebook) <= 150),
ADD COLUMN IF NOT EXISTS red_instagram TEXT CHECK (char_length(red_instagram) <= 150),
ADD COLUMN IF NOT EXISTS red_tiktok TEXT CHECK (char_length(red_tiktok) <= 150),
ADD COLUMN IF NOT EXISTS sitio_web TEXT CHECK (char_length(sitio_web) <= 150),
ADD COLUMN IF NOT EXISTS horario JSONB CHECK (jsonb_typeof(horario) = 'object'),
ADD COLUMN IF NOT EXISTS dias_especiales JSONB CHECK (jsonb_typeof(dias_especiales) = 'array');
ALTER TABLE sucursal_config
ADD COLUMN IF NOT EXISTS contacto_whatsapp TEXT CHECK (contacto_whatsapp ~ '^([0-9]{10})?$'),
ADD COLUMN IF NOT EXISTS contacto_correo TEXT CHECK (char_length(contacto_correo) <= 120),
ADD COLUMN IF NOT EXISTS red_facebook TEXT CHECK (char_length(red_facebook) <= 150),
ADD COLUMN IF NOT EXISTS red_instagram TEXT CHECK (char_length(red_instagram) <= 150),
ADD COLUMN IF NOT EXISTS red_tiktok TEXT CHECK (char_length(red_tiktok) <= 150),
ADD COLUMN IF NOT EXISTS sitio_web TEXT CHECK (char_length(sitio_web) <= 150),
ADD COLUMN IF NOT EXISTS horario JSONB CHECK (jsonb_typeof(horario) = 'object'),
ADD COLUMN IF NOT EXISTS dias_especiales JSONB CHECK (jsonb_typeof(dias_especiales) = 'array');

-- ============ BLOQUE 28: PROMOCIONES (DESCUENTOS, HAPPY HOUR Y COMBOS) ============
INSERT INTO catalogo_modulos (clave, nombre, descripcion, cobro, precio_sugerido, es_base, orden) VALUES
('promociones', 'Promociones', 'Descuentos, happy hour y combos en la caja', 'empresa', 0, FALSE, 8)
ON CONFLICT (clave) DO NOTHING;
CREATE TABLE IF NOT EXISTS promociones (
id BIGSERIAL PRIMARY KEY,
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 60),
tipo TEXT NOT NULL CHECK (tipo IN ('descuento', 'happy_hour', 'combo')),
modo TEXT CHECK (modo IN ('porcentaje', 'monto')),
valor NUMERIC(12,2) CHECK (valor > 0),
precio_combo NUMERIC(12,2) CHECK (precio_combo > 0),
aplica_a TEXT NOT NULL DEFAULT 'todo' CHECK (aplica_a IN ('todo', 'seleccion')),
desde DATE,
hasta DATE,
dias TEXT[] CHECK (dias <@ ARRAY['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']::text[] AND cardinality(dias) > 0),
hora_desde TEXT CHECK (hora_desde ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
hora_hasta TEXT CHECK (hora_hasta ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
encendida BOOLEAN NOT NULL DEFAULT TRUE,
activo BOOLEAN NOT NULL DEFAULT TRUE,
baja_motivo TEXT CHECK (char_length(baja_motivo) <= 200),
baja_en TIMESTAMPTZ,
baja_por_usuario BIGINT,
baja_por_global BIGINT REFERENCES admins_globales(id),
creado_por_usuario BIGINT,
creado_por_global BIGINT REFERENCES admins_globales(id),
creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (id, empresa_id),
FOREIGN KEY (creado_por_usuario, empresa_id) REFERENCES usuarios(id, empresa_id),
FOREIGN KEY (baja_por_usuario, empresa_id) REFERENCES usuarios(id, empresa_id),
CHECK (desde IS NULL OR hasta IS NULL OR desde <= hasta),
CHECK ((tipo = 'combo' AND precio_combo IS NOT NULL AND modo IS NULL AND valor IS NULL) OR (tipo <> 'combo' AND modo IS NOT NULL AND valor IS NOT NULL AND precio_combo IS NULL)),
CHECK (modo IS DISTINCT FROM 'porcentaje' OR valor <= 99),
CHECK (tipo <> 'happy_hour' OR (hora_desde IS NOT NULL AND hora_hasta IS NOT NULL)),
CHECK (tipo = 'happy_hour' OR (dias IS NULL AND hora_desde IS NULL AND hora_hasta IS NULL)),
CHECK (hora_desde IS NULL OR hora_hasta IS NULL OR hora_desde < hora_hasta)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_promociones_nombre ON promociones (empresa_id, lower(nombre)) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_promociones_empresa ON promociones (empresa_id, activo, encendida);
CREATE TABLE IF NOT EXISTS promocion_objetivos (
id BIGSERIAL PRIMARY KEY,
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
promocion_id BIGINT NOT NULL,
departamento_id BIGINT,
producto_id BIGINT,
servicio_id BIGINT,
CHECK (num_nonnulls(departamento_id, producto_id, servicio_id) = 1),
FOREIGN KEY (promocion_id, empresa_id) REFERENCES promociones(id, empresa_id),
FOREIGN KEY (departamento_id, empresa_id) REFERENCES departamentos(id, empresa_id),
FOREIGN KEY (producto_id, empresa_id) REFERENCES productos(id, empresa_id),
FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_objetivos_promocion ON promocion_objetivos (empresa_id, promocion_id);
CREATE TABLE IF NOT EXISTS promocion_combo_items (
id BIGSERIAL PRIMARY KEY,
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
promocion_id BIGINT NOT NULL,
presentacion_id BIGINT,
servicio_id BIGINT,
tipo_articulo_id BIGINT,
cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 20),
CHECK ((presentacion_id IS NOT NULL) <> (servicio_id IS NOT NULL)),
CHECK (tipo_articulo_id IS NULL OR servicio_id IS NOT NULL),
FOREIGN KEY (promocion_id, empresa_id) REFERENCES promociones(id, empresa_id),
FOREIGN KEY (presentacion_id, empresa_id) REFERENCES producto_presentaciones(id, empresa_id),
FOREIGN KEY (servicio_id, empresa_id) REFERENCES servicios(id, empresa_id),
FOREIGN KEY (tipo_articulo_id, empresa_id) REFERENCES tipos_articulo(id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_items_promocion ON promocion_combo_items (empresa_id, promocion_id);
CREATE TABLE IF NOT EXISTS promocion_sucursales (
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
promocion_id BIGINT NOT NULL,
sucursal_id BIGINT NOT NULL,
PRIMARY KEY (promocion_id, sucursal_id),
FOREIGN KEY (promocion_id, empresa_id) REFERENCES promociones(id, empresa_id),
FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_sucursales_empresa ON promocion_sucursales (empresa_id, sucursal_id);

-- ============ BLOQUE 29: DESCUENTOS EN LA VENTA ============
ALTER TABLE venta_partidas
ADD COLUMN IF NOT EXISTS promocion_id BIGINT REFERENCES promociones(id),
ADD COLUMN IF NOT EXISTS promocion_nombre TEXT,
ADD COLUMN IF NOT EXISTS descuento NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
ADD COLUMN IF NOT EXISTS descuento_origen TEXT CHECK (descuento_origen IN ('promocion', 'manual')),
ADD COLUMN IF NOT EXISTS descuento_motivo TEXT,
ADD COLUMN IF NOT EXISTS descuento_autorizado_por BIGINT REFERENCES usuarios(id);
ALTER TABLE empresa_config
ADD COLUMN IF NOT EXISTS descuento_manual_max NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (descuento_manual_max >= 0 AND descuento_manual_max <= 99);
ALTER TABLE sucursal_config
ADD COLUMN IF NOT EXISTS descuento_manual_max NUMERIC(5,2) CHECK (descuento_manual_max >= 0 AND descuento_manual_max <= 99);

-- ============ BLOQUE 30: PROMOCIONES "LLEVA Y PAGA" (2x1, 3x2, 3 pagando 1.5) ============
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS lleva INTEGER CHECK (lleva BETWEEN 2 AND 10);
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS paga NUMERIC(4,2) CHECK (paga > 0);
ALTER TABLE promociones
  DROP CONSTRAINT IF EXISTS promociones_tipo_check,
  DROP CONSTRAINT IF EXISTS promociones_check1,
  DROP CONSTRAINT IF EXISTS promociones_tipo_valido,
  DROP CONSTRAINT IF EXISTS promociones_forma_valida,
  ADD CONSTRAINT promociones_tipo_valido CHECK (tipo IN ('descuento', 'happy_hour', 'combo', 'lleva_paga')),
  ADD CONSTRAINT promociones_forma_valida CHECK (
    (tipo = 'combo' AND precio_combo IS NOT NULL AND modo IS NULL AND valor IS NULL AND lleva IS NULL AND paga IS NULL)
    OR (tipo = 'lleva_paga' AND lleva IS NOT NULL AND paga IS NOT NULL AND paga < lleva AND modo IS NULL AND valor IS NULL AND precio_combo IS NULL)
    OR (tipo IN ('descuento', 'happy_hour') AND modo IS NOT NULL AND valor IS NOT NULL AND precio_combo IS NULL AND lleva IS NULL AND paga IS NULL)
  );

  -- ============ BLOQUE 31: ARTICULOS DE LA NOTA (UN ARTICULO, VARIOS SERVICIOS) ============
CREATE TABLE IF NOT EXISTS venta_articulos (
id UUID NOT NULL DEFAULT gen_random_uuid(),
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
venta_id UUID NOT NULL,
orden INTEGER NOT NULL CHECK (orden > 0),
comentario TEXT CHECK (char_length(comentario) <= 300),
creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
PRIMARY KEY (id),
UNIQUE (id, empresa_id),
UNIQUE (venta_id, orden),
FOREIGN KEY (venta_id, empresa_id) REFERENCES ventas(id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_venta_articulos_venta ON venta_articulos (empresa_id, venta_id);
ALTER TABLE partida_servicio ADD COLUMN IF NOT EXISTS venta_articulo_id UUID REFERENCES venta_articulos(id);
CREATE INDEX IF NOT EXISTS idx_partida_servicio_articulo ON partida_servicio (venta_articulo_id);

-- ============ BLOQUE 32: ARTICULOS GUARDADOS DEL CLIENTE ============
CREATE TABLE IF NOT EXISTS cliente_articulos (
id UUID NOT NULL DEFAULT gen_random_uuid(),
empresa_id BIGINT NOT NULL REFERENCES empresas(id),
cliente_id UUID NOT NULL,
clave TEXT NOT NULL,
marca TEXT NOT NULL DEFAULT '',
talla TEXT NOT NULL DEFAULT '',
color TEXT NOT NULL DEFAULT '',
modelo TEXT NOT NULL DEFAULT '',
textura TEXT NOT NULL DEFAULT '',
descripcion TEXT NOT NULL DEFAULT '',
ultimos_servicios JSONB NOT NULL DEFAULT '[]'::jsonb,
veces INTEGER NOT NULL DEFAULT 1 CHECK (veces > 0),
ultima_vez TIMESTAMPTZ NOT NULL DEFAULT now(),
activo BOOLEAN NOT NULL DEFAULT TRUE,
baja_motivo TEXT,
baja_en TIMESTAMPTZ,
baja_por BIGINT,
creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
PRIMARY KEY (id),
UNIQUE (id, empresa_id),
FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id),
FOREIGN KEY (baja_por, empresa_id) REFERENCES usuarios(id, empresa_id),
CHECK (activo OR baja_motivo IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_articulos_clave ON cliente_articulos (empresa_id, cliente_id, clave) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_cliente_articulos_cliente ON cliente_articulos (empresa_id, cliente_id, ultima_vez DESC);