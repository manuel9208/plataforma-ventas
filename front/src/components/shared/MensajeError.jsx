export default function MensajeError({ error, detalles = [], etiquetas = {} }) {
  if (!error) return null;
  return (
    <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
      <p>{error}</p>
      {detalles.map((d, i) => (
        <p key={i}>
          {etiquetas[d.campo] ?? d.campo}: {d.mensaje}
        </p>
      ))}
    </div>
  );
}