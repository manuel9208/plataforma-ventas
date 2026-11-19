// Junta los servicios de una nota por artículo físico (unos tenis con lavado + suela).
// Una nota vieja, sin articuloId, queda como un artículo por cada servicio.
export function agruparServicios(servicios = []) {
  const grupos = [];
  const porId = new Map();
  for (const s of servicios) {
    if (!s.articuloId) {
      grupos.push({ id: s.partidaId, articulo: s.articulo, comentario: s.comentario ?? null, servicios: [s] });
      continue;
    }
    let g = porId.get(s.articuloId);
    if (!g) {
      g = { id: s.articuloId, articulo: s.articulo, comentario: s.comentario ?? null, servicios: [] };
      porId.set(s.articuloId, g);
      grupos.push(g);
    }
    g.servicios.push(s);
  }
  return grupos;
}