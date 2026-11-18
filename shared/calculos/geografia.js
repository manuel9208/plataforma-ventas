const RADIO_TIERRA_KM = 6371;
const aRadianes = (g) => (g * Math.PI) / 180;

// Distancia en km entre dos puntos { lat, lon }
export function distanciaKm(a, b) {
  const dLat = aRadianes(b.lat - a.lat);
  const dLon = aRadianes(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

export function sucursalMasCercana(punto, sucursales) {
  let mejor = null;
  let mejorDistancia = Infinity;
  for (const s of sucursales) {
    const d = distanciaKm(punto, s);
    if (d < mejorDistancia) {
      mejor = s;
      mejorDistancia = d;
    }
  }
  return mejor;
}