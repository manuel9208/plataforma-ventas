// Comunicación con el programa de impresión que corre en esta computadora (pos-bridge)
const PUERTO = 9631;
const BASE = `http://127.0.0.1:${PUERTO}`;
const CLAVE = 'impresora_equipo';

const DEFECTO = { via: 'navegador', acentos: true, autoImprimir: true, autoSiguiente: true, destino: { tipo: 'usb', nombre: '' } };

// La impresora pertenece a ESTA computadora, por eso se guarda aquí y no en la base de datos
export function leerConfigImpresora() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    return { ...DEFECTO, ...g, destino: { ...DEFECTO.destino, ...g.destino } };
  } catch {
    return DEFECTO;
  }
}

export const guardarConfigImpresora = (cfg) => localStorage.setItem(CLAVE, JSON.stringify(cfg));

// { activo: true, version, impresoras: [{ nombre, predeterminada }] } o { activo: false }
export async function estadoPuente() {
  try {
    const r = await fetch(`${BASE}/salud`, { signal: AbortSignal.timeout(2000) });
    const d = await r.json();
    return d.ok ? { activo: true, version: d.version, impresoras: d.impresoras ?? [] } : { activo: false };
  } catch {
    return { activo: false };
  }
}

// bytes: Uint8Array con los comandos de la impresora · destino: { tipo: 'usb', nombre } o { tipo: 'ip', host, puerto }
export async function enviarAlPuente(base64, destino) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}/imprimir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destino, datos: base64 }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('el programa de impresión no responde');
  }
  const d = await respuesta.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || 'la impresora no aceptó el ticket');
}

// El comando que se pega en PowerShell para instalar el programa en esta computadora
export function comandoInstalacion() {
  const api = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  return `& ([scriptblock]::Create((irm '${api}/pos-bridge/instalar.ps1'))) -Api '${api}' -Origen '${window.location.origin}'`;
}