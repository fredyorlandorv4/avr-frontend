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

test('separa las unidades en estados de cuenta con encabezado, contrato y saldo propios', async () => {
  const statement = {
    issuer: { company: 'Barozzi', address: 'Dirección', nit: '120526379' },
    generated_at: '2026-11-17T12:00:00-06:00',
    customer: { code: 'CL1', name: 'Cliente', project: 'Zona AX', units: ['C-1', 'C-2'] },
    sap_fields: { receipt_number: true, payment_date: true, contract_number: true },
    installments: [
      { unit: 'C-1', contract_number: 'Contrato-1', installment_number: 1, balance: 10 },
      { unit: 'C-2', contract_number: 'Contrato-2', installment_number: 1, balance: 20 },
    ],
  };
  const pdf = await buildBuildingStatementPdf(statement);
  assert.equal(pdf.getNumberOfPages(), 2);
  const firstPage = pdf.internal.pages[1].join('');
  const secondPage = pdf.internal.pages[2].join('');
  assert.match(firstPage, /Barozzi/);
  assert.match(firstPage, /Zona AX/);
  assert.match(firstPage, /Contrato-1/);
  assert.doesNotMatch(firstPage, /C-2/);
  assert.match(secondPage, /Barozzi/);
  assert.match(secondPage, /Contrato-2/);
  assert.match(secondPage, /C-2/);
});

test('muestra todos los números de recibo aunque ocupen varias páginas', async () => {
  const receipts = Array.from({ length: 100 }, (_, index) => `RC-${String(index).padStart(3, '0')}`);
  const pdf = await buildBuildingStatementPdf({
    issuer: { company: 'Barozzi', address: 'Dirección', nit: '120526379' },
    generated_at: '2026-11-17',
    customer: { code: 'CL1', name: 'Cliente', project: 'Zona AX' },
    sap_fields: { receipt_number: true, payment_date: true, contract_number: true },
    installments: [{ unit: 'CL-705', installment_number: 1, balance: 10,
      receipt_number: `,${receipts.join(',')}` }],
  });
  assert.ok(pdf.getNumberOfPages() > 1);
  const content = pdf.internal.pages.slice(1).map((page) => page.join('')).join('');
  for (const receipt of receipts) assert.ok(content.includes(receipt), `Falta ${receipt}`);
});
