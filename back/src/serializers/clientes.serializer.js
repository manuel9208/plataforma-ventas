import { estadoPerfil } from '@plataforma/calculos';

export const serializarCliente = (f) => ({
  id: f.id,
  nombre: f.nombre,
  telefono: f.telefono,
  correo: f.correo,
  notas: f.notas,
  aceptaWhatsapp: f.acepta_whatsapp,
  consentimientoWhatsappEn: f.consentimiento_whatsapp_en,
  cumpleanos: f.cumple_mes && f.cumple_dia ? { mes: f.cumple_mes, dia: f.cumple_dia } : null,
  tienePin: Boolean(f.tiene_pin),
  // { completo, falta: ['correo', 'cumpleaños', 'PIN'] }
  perfil: estadoPerfil({ correo: f.correo, cumpleMes: f.cumple_mes, cumpleDia: f.cumple_dia, tienePin: f.tiene_pin }),
  activo: f.activo,
  creadoEn: f.creado_en,
});