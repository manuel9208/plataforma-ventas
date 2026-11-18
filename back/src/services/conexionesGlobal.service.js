import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import { cifrar, descifrar } from '../utils/cifrado.js';
import { modulosActivos } from '../utils/modulos.js';
import * as empresas from '../repositories/empresas.repository.js';
import * as repo from '../repositories/conexiones.repository.js';
import { grupoVista, variableVista } from '../serializers/conexionesGlobal.serializer.js';

const leer = (cifrado) => {
  try {
    return descifrar(cifrado);
  } catch {
    return null; // si la llave maestra cambió, no se puede leer
  }
};

async function cargarEmpresa(id) {
  const e = await empresas.obtener(pool, id);
  if (!e) throw new ErrorHttp(404, 'Empresa no encontrada');
  return e;
}

async function cargarGrupo(grupo) {
  const g = (await repo.listarGrupos(pool)).find((x) => x.grupo === grupo);
  if (!g) throw new ErrorHttp(404, 'Servicio no encontrado');
  return g;
}

async function validarAlcance(empresaId, grupo, sucursalId) {
  if (!sucursalId) return;
  if (grupo.nivel !== 'ambos') throw new ErrorHttp(400, 'Este servicio se configura para toda la empresa, no por sucursal.');
  if (!(await repo.sucursalActiva(pool, empresaId, sucursalId))) throw new ErrorHttp(404, 'Sucursal no encontrada');
}

const bitacora = (actor, empresaId, sucursalId, accion, despues, ip) =>
  registrarBitacora(pool, { empresaId, sucursalId: sucursalId ?? null, adminGlobalId: actor.adminGlobalId, accion, entidad: 'conexion', despues, ip });

// ---------- Ver ----------
export async function listar(empresaId, sucursalId) {
  const e = await cargarEmpresa(empresaId);
  if (sucursalId && !(await repo.sucursalActiva(pool, empresaId, sucursalId))) throw new ErrorHttp(404, 'Sucursal no encontrada');

  const [grupos, variables, deEmpresa, deSucursal, activos, sucursales] = await Promise.all([
    repo.listarGrupos(pool),
    repo.listarVariables(pool),
    repo.valoresEmpresa(pool, empresaId),
    sucursalId ? repo.valoresSucursal(pool, empresaId, sucursalId) : new Map(),
    modulosActivos(empresaId),
    repo.listarSucursales(pool, empresaId),
  ]);

  // Por sucursal solo se ven los servicios que se pueden configurar así
  const visibles = sucursalId ? grupos.filter((g) => g.nivel === 'ambos') : grupos;

  return {
    empresa: { id: e.id, nombre: e.nombre },
    sucursales,
    sucursalId: sucursalId ?? null,
    grupos: visibles.map((g) => {
      const delGrupo = variables.filter((v) => v.grupo === g.grupo);
      const propia = Boolean(sucursalId) && delGrupo.some((v) => deSucursal.has(v.clave));
      // Sin configuración propia, la sucursal usa la de la empresa (solo lectura)
      const fuente = sucursalId && propia ? deSucursal : deEmpresa;
      return grupoVista(
        g,
        delGrupo.map((v) => variableVista(v, fuente.get(v.clave), leer)),
        { propia, heredada: Boolean(sucursalId) && !propia, moduloActivo: g.modulo ? activos.includes(g.modulo) : true }
      );
    }),
  };
}

function validarValor(v, texto) {
  if (v.tipo === 'numero' && !/^\d{1,6}$/.test(texto)) throw new ErrorHttp(400, `${v.etiqueta ?? v.clave}: escribe solo números`);
  if (v.tipo === 'opcion') {
    const validas = (v.opciones ?? []).map((o) => o.slice(0, o.indexOf(':')));
    if (!validas.includes(texto)) throw new ErrorHttp(400, `${v.etiqueta ?? v.clave}: opción no válida`);
  }
}

// ---------- Guardar ----------
export async function guardarGrupo(actor, empresaId, grupo, sucursalId, valores, ip) {
  await cargarEmpresa(empresaId);
  const g = await cargarGrupo(grupo);
  await validarAlcance(empresaId, g, sucursalId);

  const delGrupo = new Map((await repo.listarVariables(pool)).filter((v) => v.grupo === grupo).map((v) => [v.clave, v]));
  const guardar = [];
  const quitar = [];
  for (const [clave, texto] of Object.entries(valores)) {
    const v = delGrupo.get(clave);
    if (!v) throw new ErrorHttp(400, `La clave ${clave} no pertenece a este servicio`);
    if (texto === null || texto === '') {
      quitar.push(clave);
    } else {
      validarValor(v, texto);
      guardar.push([clave, texto]);
    }
  }
  if (!guardar.length && !quitar.length) throw new ErrorHttp(400, 'No hay cambios que guardar');

  await conTransaccion(async (db) => {
    for (const [clave, texto] of guardar) await repo.guardarValor(db, empresaId, sucursalId ?? null, clave, cifrar(texto));
    await repo.borrarValores(db, empresaId, sucursalId ?? null, quitar);
    // La bitácora lleva solo los nombres de las llaves, nunca su valor
    await registrarBitacora(db, {
      empresaId,
      sucursalId: sucursalId ?? null,
      adminGlobalId: actor.adminGlobalId,
      accion: 'conexion.guardar',
      entidad: 'conexion',
      despues: { grupo, alcance: sucursalId ? 'sucursal' : 'empresa', guardadas: guardar.map(([c]) => c), quitadas: quitar },
      ip,
    });
  });
  return listar(empresaId, sucursalId);
}

// La sucursal vuelve a usar la configuración de la empresa
export async function quitarGrupoDeSucursal(actor, empresaId, grupo, sucursalId, ip) {
  await cargarEmpresa(empresaId);
  const g = await cargarGrupo(grupo);
  await validarAlcance(empresaId, g, sucursalId);

  const claves = (await repo.listarVariables(pool)).filter((v) => v.grupo === grupo).map((v) => v.clave);
  const borradas = await conTransaccion((db) => repo.borrarValores(db, empresaId, sucursalId, claves));
  if (!borradas) throw new ErrorHttp(409, 'Esta sucursal ya usa la configuración de la empresa');

  await bitacora(actor, empresaId, sucursalId, 'conexion.quitar_propia', { grupo, quitadas: borradas }, ip);
  return listar(empresaId, sucursalId);
}

// ---------- Revelar una llave (solo secretas, queda en bitácora) ----------
export async function revelar(actor, empresaId, { clave, sucursalId }, ip) {
  await cargarEmpresa(empresaId);
  const v = (await repo.listarVariables(pool)).find((x) => x.clave === clave);
  if (!v || !v.es_secreto) throw new ErrorHttp(400, 'Esa llave no es secreta o no existe');
  if (sucursalId && !(await repo.sucursalActiva(pool, empresaId, sucursalId))) throw new ErrorHttp(404, 'Sucursal no encontrada');

  const cifrado = await repo.obtenerCifrado(pool, empresaId, sucursalId ?? null, clave);
  const valor = cifrado ? leer(cifrado) : null;
  if (valor === null) throw new ErrorHttp(404, 'Esa llave no está guardada en este nivel');

  await bitacora(actor, empresaId, sucursalId, 'conexion.revelar', { clave, alcance: sucursalId ? 'sucursal' : 'empresa' }, ip);
  return { clave, valor };
}