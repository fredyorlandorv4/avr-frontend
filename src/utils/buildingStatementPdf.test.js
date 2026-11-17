import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { buildBuildingStatementPdf } from './buildingStatementPdf.js';

test('genera un PDF multipágina con todas las cuotas del estado de cuenta', async () => {
  const statement = {
    issuer: { company: 'CAMELLE, S.A.', address: '13 calle 05-31 zona 9, edificio Ascend 5to nivel, oficina 540 Guatemala', nit: '120526379' },
    generated_at: '2026-11-16T12:00:00-06:00',
    customer: { code: 'CL0027', name: 'Cliente de ejemplo', contract_number: null, units: ['816'], project: 'Empresa' },
    sap_fields: { receipt_number: false, payment_date: false, contract_number: false },
    total_balance: 24919.58,
    installments: Array.from({ length: 34 }, (_, index) => ({
      unit: '816', installment_number: index + 1, due_date: '2026-11-30',
      installment_amount: 735.87, payment_date: null, amount_paid: 0,
      balance: 735.87, receipt_number: null,
    })),
  };
  const pdf = await buildBuildingStatementPdf(statement);
  assert.equal(pdf.getNumberOfPages(), 2);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
});
