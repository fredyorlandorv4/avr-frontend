import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessagingDashboard } from './messagingDashboard.js';

test('agrupa mensajes y cartera por proyecto y mantiene monedas separadas', () => {
  const clients = [
    { tipo_cartera: 'lotes', empresa: 'Empresa A', lotes: [{ proyecto: 'Alborada', cuotas_atrasadas: [{ fecha_compromiso: '2026-11-01', total_a_pagar: 100.2 }, { fecha_compromiso: '2026-11-23', total_a_pagar: 500 }] }, { proyecto: 'Alborada', cuotas_atrasadas: [{ fecha_compromiso: '2026-11-22', total_a_pagar: 50.1 }, { fecha_compromiso: '2026-12-01', total_a_pagar: 900 }, { fecha_compromiso: null, total_a_pagar: 50 }] }] },
    { tipo_cartera: 'edificios', empresa: 'SBO_BAROZZI', lotes: [{ proyecto: 'Empresa B', cuotas_atrasadas: [{ fecha_compromiso: '2026-11-01', total_a_pagar: 311.46 }, { fecha_compromiso: '2026-11-24', total_a_pagar: 200 }] }] },
  ];
  const sent = [{ tipo_cartera: 'lotes', empresa: 'Empresa A', proyecto: 'Alborada', enviados: 3 }, { tipo_cartera: 'edificios', empresa: 'Empresa B', proyecto: 'Empresa B', proyecto_configurado: 'Zobel', enviados: 2 }];
  const result = buildMessagingDashboard(clients, sent, [{ company_name: 'Empresa B', project_name: 'Zobel', active: true }], '2026-11-23');
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.totals, { sent: 5, GTQ: 15030, USD: 31146 });
  assert.equal(result.rows.find(row => row.project === 'Zobel').sent, 2);
});

test('cuenta clientes y proyectos con saldo sin duplicar registros', () => {
  const clients = [
    { codigo_cliente: '1', empresa: 'A', lotes: [{ proyecto: 'Uno', total_pendiente_lote: 10 }, { proyecto: 'Dos', total_pendiente_lote: 20 }] },
    { codigo_cliente: '1', empresa: 'A', lotes: [{ proyecto: 'Uno', total_pendiente_lote: 10 }] },
    { codigo_cliente: '2', empresa: 'A', lotes: [{ proyecto: 'Uno', cuotas: [{ saldo: 5 }] }] },
    { codigo_cliente: '3', empresa: 'A', lotes: [{ proyecto: 'Tres', total_pendiente_lote: 0 }] },
  ];
  const result = buildMessagingDashboard(clients, [], []);
  assert.equal(result.pendingClientCount, 2);
  assert.equal(result.pendingProjectCount, 2);
});

test('desglosa saldo vencido y mensajes filtrados por cliente, y cuenta proyectos SAP sin saldo', () => {
  const clients = [{ codigo_cliente: 'C1', nombre_cliente: 'Ana', empresa: 'A', lotes: [{ proyecto: 'Uno', cuotas_atrasadas: [
    { fecha_compromiso: '2026-11-01', total_a_pagar: 20 },
    { fecha_compromiso: '2026-11-05', total_a_pagar: 30 },
    { fecha_compromiso: '2026-11-23', total_a_pagar: 100 },
  ] }] }];
  const deliveries = [{ empresa: 'A', proyecto: 'Uno', codigo_cliente: 'C1', nombre_cliente: 'Ana', enviados: 2 }];
  const status = [{ empresa: 'A', proyecto: 'Uno', saldo_pendiente: true }, { empresa: 'B', proyecto: 'Dos', saldo_pendiente: false }];
  const result = buildMessagingDashboard(clients, [], [], '2026-11-23', deliveries, status);
  const customer = [...result.rows[0].customers.values()][0];
  assert.deepEqual([customer.cents, customer.installments, customer.sent], [5000, 1, 2]);
  assert.equal(result.currentProjectCount, 1);
  assert.equal(result.pendingProjectCount, 1);
});
