import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOverdueInstallments } from './overdueInstallments.js';

test('combina saldos del mismo mes y numera las cuotas desde uno', () => {
  const rows = [
    { numero_cuota: 3, concepto: 'Gastos Administrativos', fecha_compromiso: '2026-09-30', antiguedad: '1-30 días', total_a_pagar: 816.67 },
    { numero_cuota: 0, concepto: 'Anticipo', fecha_compromiso: '2026-08-31', antiguedad: '31-60 días', total_a_pagar: 633.33 },
    { numero_cuota: 2, concepto: 'Anticipo', fecha_compromiso: '2026-09-30', antiguedad: '1-30 días', total_a_pagar: 816.66 },
  ];

  assert.deepEqual(groupOverdueInstallments(rows).map(({ number, concept, dueDate, total }) => ({ number, concept, dueDate, total })), [
    { number: 1, concept: 'Cuota agosto', dueDate: '2026-08-31', total: 633.33 },
    { number: 2, concept: 'Cuota septiembre', dueDate: '2026-09-30', total: 1633.33 },
  ]);
});

test('no mezcla el mismo mes de años diferentes y conserva la fecha más antigua del mes', () => {
  const rows = [
    { fecha_compromiso: '2026-09-30', antiguedad: '1-30 días', total_a_pagar: 1 },
    { fecha_compromiso: '2025-09-30', antiguedad: 'Más de 360 días', total_a_pagar: 2 },
    { fecha_compromiso: '2026-09-15', antiguedad: '31-60 días', total_a_pagar: 3 },
  ];

  const groups = groupOverdueInstallments(rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(({ number, dueDate, age, total }) => ({ number, dueDate, age, total })), [
    { number: 1, dueDate: '2025-09-30', age: 'Más de 360 días', total: 2 },
    { number: 2, dueDate: '2026-09-15', age: '31-60 días', total: 4 },
  ]);
});
