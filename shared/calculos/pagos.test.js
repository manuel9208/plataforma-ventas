import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstadoPago } from './pagos.js';

test('sin pagos queda pendiente', () => {
  assert.deepEqual(calcularEstadoPago(150, []), { estado: 'pendiente', pagado: 0, saldo: 150 });
});

test('un abono la deja abonada', () => {
  assert.deepEqual(calcularEstadoPago(150, [50]), { estado: 'abonada', pagado: 50, saldo: 100 });
});

test('pagos que suman el total la dejan pagada', () => {
  assert.deepEqual(calcularEstadoPago(150, [50, 100]), { estado: 'pagada', pagado: 150, saldo: 0 });
});

test('no tiene errores de decimales', () => {
  assert.equal(calcularEstadoPago(0.3, [0.1, 0.2]).estado, 'pagada');
});