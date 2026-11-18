import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// El PIN se mezcla con una llave del servidor: sin ella, el hash no se puede adivinar
const LLAVE = crypto.createHmac('sha256', env.MASTER_KEY).update('pin-v1').digest();
const preparar = (pin) => crypto.createHmac('sha256', LLAVE).update(String(pin)).digest('hex');

export const hashPin = (pin) => bcrypt.hash(preparar(pin), 12);
export const verificarPin = (pin, hash) => bcrypt.compare(preparar(pin), hash);

// PIN de entrega de la nota: 4 dígitos al azar, del 0000 al 9999
export const generarPinEntrega = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');