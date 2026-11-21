// puntos: lo que manda el servidor al cobrar o entregar: { ganados, habriaGanado?, falta? }
export default function AvisoPuntos({ puntos }) {
  if (!puntos) return null;

  if (puntos.ganados > 0) {
    return (
      <p className="rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold text-center py-2.5 px-3">
        Ganó {puntos.ganados} {puntos.ganados === 1 ? 'punto' : 'puntos'}
      </p>
    );
  }
  if (puntos.habriaGanado > 0) {
    return (
      <p className="rounded-xl bg-amber-50 text-amber-800 text-sm text-center py-2.5 px-3">
        Con su perfil completo habría ganado {puntos.habriaGanado} {puntos.habriaGanado === 1 ? 'punto' : 'puntos'}.
        {(puntos.falta ?? []).length > 0 ? ` Falta: ${puntos.falta.join(', ')}.` : ''}
      </p>
    );
  }
  return null;
}