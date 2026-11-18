export const serializarCliente = (f) => ({
  id: f.id,
  nombre: f.nombre,
  telefono: f.telefono,
  correo: f.correo,
  notas: f.notas,
  aceptaWhatsapp: f.acepta_whatsapp,
  consentimientoWhatsappEn: f.consentimiento_whatsapp_en,
  activo: f.activo,
  creadoEn: f.creado_en,
});