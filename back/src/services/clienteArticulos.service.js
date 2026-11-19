import { claveArticulo } from '@plataforma/calculos';
import { pool, conTransaccion } from '../config/db.js';
import { ErrorHttp } from '../utils/errores.js';
import { registrarBitacora } from '../utils/bitacora.js';
import * as repo from '../repositories/clienteArticulos.repository.js';
import * as clientesRepo from '../repositories/clientes.repository.js';
import * as turnosRepo from '../repositories/turnos.repository.js';
import * as notasRepo from '../repositories/notas.repository.js';
import { serializarClienteArticulo } from '../serializers/clienteArticulos.serializer.js';

const MAX_LISTA = 50;
const MAX_SERVICIOS_GUARDADOS = 10;

// ---------- Guardar (se llama dentro de la transacción del cobro) ----------
// servicios: la lista de servicios ya armada y validada por ventas.service (cada uno trae su "articulo" limpio)
function agruparParaGuardar(servicios) {
  const porClave = new Map();
  for (const s of servicios) {
    const clave = claveArticulo(s.articulo);
    if (!clave) continue;
    // Dos artículos iguales en la misma nota cuentan como una sola visita
    if (!porClave.has(clave)) {
      porClave.set(clave, {
        clave,
        datos: {
          marca: s.articulo.marca ?? '',
          talla: s.articulo.talla ?? '',
          color: s.articulo.color ?? '',
          modelo: s.articulo.modelo ?? '',
          textura: s.articulo.textura ?? '',
          descripcion: s.articulo.descripcion ?? '',
        },
        servicios: new Map(),
      });
    }
    const par = `${s.servicioId}|${s.tipoArticuloId}`;
    const a = porClave.get(clave);
    if (!a.servicios.has(par)) {
      a.servicios.set(par, {
        servicioId: s.servicioId,
        tipoArticuloId: s.tipoArticuloId,
        nombre: s.nombre,
        tipo: s.tipoNombre,
        extraIds: s.extras.map((x) => x.extraId),
      });
    }
  }
  return [...porClave.values()].map((a) => ({
    clave: a.clave,
    datos: a.datos,
    ultimosServicios: [...a.servicios.values()].slice(0, MAX_SERVICIOS_GUARDADOS),
  }));
}

// Guardar los artículos es secundario: si algo falla, el cobro NO se detiene (punto de retorno dentro de la transacción)
export async function guardarArticulosDeCliente(db, empresaId, clienteId, servicios) {
  const articulos = agruparParaGuardar(servicios);
  if (!articulos.length) return;
  await db.query('SAVEPOINT articulos_cliente');
  try {
    for (const a of articulos) await repo.guardar(db, empresaId, clienteId, a);
    await db.query('RELEASE SAVEPOINT articulos_cliente');
  } catch (err) {
    await db.query('ROLLBACK TO SAVEPOINT articulos_cliente');
    console.error('No se pudieron guardar los artículos del cliente:', err.code ?? err.message);
  }
}

// ---------- Listar ----------
// Servicios de HOY en la sucursal del turno abierto: solo vuelven los que siguen activos, en la sucursal y con precio
async function cargarVigentes(empresaId, sucursalId, guardados) {
  const ids = [...new Set(guardados.map((s) => s.servicioId))];
  const { filas } = await notasRepo.listarServicios(pool, empresaId, sucursalId, {
    ids,
    limite: ids.length,
    pagina: 1,
  });
  return new Map(filas.map((f) => [Number(f.id), f]));
}

function resolver(guardados, vigentes) {
  return guardados.map((g) => {
    // Sin turno abierto no se sabe la sucursal: se muestra lo guardado
    if (!vigentes) return { g, disponible: null };
    const sv = vigentes.get(Number(g.servicioId));
    const precio = sv?.precios.find((p) => Number(p.tipoArticuloId) === Number(g.tipoArticuloId));
    return sv && precio ? { g, sv, precio, disponible: true } : { g, disponible: false };
  });
}

export async function listar(actor, clienteId) {
  const e = actor.empresaId;
  if (!(await clientesRepo.obtener(pool, e, clienteId))) throw new ErrorHttp(404, 'Cliente no encontrado');

  const filas = await repo.listar(pool, e, clienteId, MAX_LISTA);
  const turno = actor.esGlobal ? null : await turnosRepo.turnoAbiertoDeUsuario(pool, e, actor.id);
  const guardados = filas.flatMap((f) => f.ultimos_servicios);
  const vigentes = turno && guardados.length ? await cargarVigentes(e, turno.sucursal_id, guardados) : null;

  return { datos: filas.map((f) => serializarClienteArticulo(f, resolver(f.ultimos_servicios, vigentes))) };
}

// ---------- Baja de un artículo guardado ----------
export async function darDeBaja(actor, clienteId, articuloId, motivo, ip) {
  return conTransaccion(async (db) => {
    const antes = await repo.darDeBaja(db, actor.empresaId, clienteId, articuloId, {
      motivo,
      usuarioId: actor.esGlobal ? null : actor.id,
    });
    if (!antes) throw new ErrorHttp(404, 'Artículo no encontrado');
    await registrarBitacora(db, {
      empresaId: actor.empresaId,
      usuarioId: actor.id,
      adminGlobalId: actor.adminGlobalId,
      accion: 'cliente_articulo.baja',
      entidad: 'cliente_articulo',
      entidadUuid: articuloId,
      antes,
      despues: { activo: false, motivo },
      ip,
    });
    return { ok: true };
  });
}