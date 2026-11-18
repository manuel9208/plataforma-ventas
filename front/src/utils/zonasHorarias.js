// Zonas horarias que se ofrecen al crear empresas y sucursales
export const ZONAS = [
  ['America/Mexico_City', 'Ciudad de México · Jalisco'],
  ['America/Mazatlan', 'Mazatlán · Sinaloa'],
  ['America/Tijuana', 'Tijuana'],
  ['America/Hermosillo', 'Hermosillo · Sonora'],
  ['America/Chihuahua', 'Chihuahua'],
  ['America/Cancun', 'Cancún'],
];

export const nombreZona = (id) => ZONAS.find(([z]) => z === id)?.[1] ?? id;