import { AJUSTES } from '@plataforma/calculos';
import { exigirEmpresa } from '../utils/tenant.js';

// Las columnas salen de la lista declarativa, nunca de lo que mande el usuario
const POR_CLAVE = new Map(AJUSTES.map((a) => [a.clave, a]));
const unicas = (lista) => [...new Set(lista.map((a) => a.columna))].join(', ');
const COLUMNAS_EMPRESA = unicas(AJUSTES);
// IVA y existencias son solo de la empresa: la sucursal no tiene esas columnas
const COLUMNAS_SUCURSAL_CONFIG = unicas(AJUSTES.filter((a) => a.nivel === 'ambos'));

function aAjustes(fila) {
  const r = {};
  for (const a of AJUSTES) {
    const v = a.subclave ? fila?.[a.columna]?.[a.subclave] : fila?.[a.columna];
    r[a.clave] = v === undefined || v === null ? null : a.tipo === 'numero' || a.tipo === 'dinero' ? Number(v) : v;
  }
  return r;
}

// Arma el SET del UPDATE. "cambios" = { claveDelAjuste: valor }. Un valor null en un dato JSON quita ese dato (hereda).
function armarSets(cambios, primerParametro, soloAmbos) {
  const sets = [];
  const valores = [];
  const json = new Map();
  const param = (v) => {
    valores.push(v);
    return `$${primerParametro + valores.length - 1}`;
  };
  for (const [clave, valor] of Object.entries(cambios)) {
    const a = POR_CLAVE.get(clave);
    if (!a || (soloAmbos && a.nivel !== 'ambos')) throw new Error('Ajuste no permitido');
    if (a.subclave) {
      const j = json.get(a.columna) ?? { poner: {}, quitar: [] };
      if (valor === null) j.quitar.push(a.subclave);
      else j.poner[a.subclave] = valor;
      json.set(a.columna, j);
    } else if (a.tipo === 'horario' || a.tipo === 'fechas') {
      sets.push(`${a.columna} = ${param(valor === null ? null : JSON.stringify(valor))}::jsonb`);
    } else {
      sets.push(`${a.columna} = ${param(valor)}`);
    }
  }
  for (const [columna, j] of json) {
    sets.push(`${columna} = ((COALESCE(${columna}, '{}'::jsonb) || ${param(JSON.stringify(j.poner))}::jsonb) - ${param(j.quitar)}::text[])`);
  }
  if (!sets.length) throw new Error('Sin cambios');
  return { sets: sets.join(', '), valores };
}

// Ajustes de la empresa y, si se pide, los propios de una sucursal (null = hereda)
export async function leerConfig(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const e = await db.query(`SELECT ${COLUMNAS_EMPRESA} FROM empresa_config WHERE empresa_id = $1`, [empresaId]);
  const s = sucursalId
    ? await db.query(`SELECT ${COLUMNAS_SUCURSAL_CONFIG} FROM sucursal_config WHERE empresa_id = $1 AND sucursal_id = $2`, [empresaId, sucursalId])
    : { rows: [] };
  return { empresa: aAjustes(e.rows[0]), sucursal: aAjustes(s.rows[0]) };
}

export async function guardarConfigEmpresa(db, empresaId, cambios) {
  exigirEmpresa(empresaId);
  const { sets, valores } = armarSets(cambios, 2, false);
  await db.query(`INSERT INTO empresa_config (empresa_id) VALUES ($1) ON CONFLICT DO NOTHING`, [empresaId]);
  await db.query(`UPDATE empresa_config SET ${sets}, actualizado_en = now() WHERE empresa_id = $1`, [empresaId, ...valores]);
}

export async function guardarConfigSucursal(db, empresaId, sucursalId, cambios) {
  exigirEmpresa(empresaId);
  const { sets, valores } = armarSets(cambios, 3, true);
  await db.query(`INSERT INTO sucursal_config (empresa_id, sucursal_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [empresaId, sucursalId]);
  await db.query(`UPDATE sucursal_config SET ${sets}, actualizado_en = now() WHERE empresa_id = $1 AND sucursal_id = $2`, [
    empresaId,
    sucursalId,
    ...valores,
  ]);
}

// ---------- Datos de la sucursal ----------
const COLUMNAS_SUCURSAL = 'id, nombre, activo, telefono, direccion, lat, lon, zona_horaria, es_principal, referencias, mapa_url';
const SUCURSAL_EDITABLES = new Set(['nombre', 'telefono', 'direccion', 'lat', 'lon', 'zona_horaria', 'referencias', 'mapa_url']);

export async function listarSucursales(db, empresaId) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS_SUCURSAL} FROM sucursales WHERE empresa_id = $1 ORDER BY nombre, id`, [empresaId]);
  return r.rows;
}

export async function obtenerSucursal(db, empresaId, id) {
  exigirEmpresa(empresaId);
  const r = await db.query(`SELECT ${COLUMNAS_SUCURSAL} FROM sucursales WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
  return r.rows[0] || null;
}

export async function actualizarSucursal(db, empresaId, id, campos) {
  exigirEmpresa(empresaId);
  const claves = Object.keys(campos);
  if (!claves.length || !claves.every((c) => SUCURSAL_EDITABLES.has(c))) throw new Error('Columnas no permitidas');
  const sets = claves.map((c, i) => `${c} = $${i + 3}`).join(', ');
  await db.query(`UPDATE sucursales SET ${sets} WHERE empresa_id = $1 AND id = $2`, [empresaId, id, ...claves.map((c) => campos[c])]);
}

// Solo una sucursal es la principal: primero se quita la actual y luego se marca la nueva
export async function marcarPrincipal(db, empresaId, id) {
  exigirEmpresa(empresaId);
  await db.query(`UPDATE sucursales SET es_principal = FALSE WHERE empresa_id = $1 AND es_principal`, [empresaId]);
  await db.query(`UPDATE sucursales SET es_principal = TRUE WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
}

// Datos que reemplazan las variables del pie del ticket
export async function datosParaPie(db, empresaId, sucursalId) {
  exigirEmpresa(empresaId);
  const r = await db.query(
    `SELECT e.nombre AS empresa, s.nombre AS sucursal, s.direccion, s.telefono
     FROM sucursales s JOIN empresas e ON e.id = s.empresa_id
     WHERE s.empresa_id = $1 AND s.id = $2`,
    [empresaId, sucursalId]
  );
  const f = r.rows[0] ?? {};
  return { empresa: f.empresa, sucursal: f.sucursal, direccion: f.direccion, telefono_sucursal: f.telefono };
}