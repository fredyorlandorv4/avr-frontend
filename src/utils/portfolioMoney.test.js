import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioCurrency, formatPortfolioMoney } from './portfolioMoney.js';
import { groupOverdueInstallments } from './overdueInstallments.js';

test('edificios muestra dólares y lotes conserva quetzales, también en Todo', () => {
  const clients = [{ tipo_cartera: 'edificios' }, { tipo_cartera: 'lotes' }, {}];
  assert.deepEqual(clients.map(portfolioCurrency), ['USD', 'GTQ', 'GTQ']);
  const totals = clients.map(client => formatPortfolioMoney(1234.56, portfolioCurrency(client)));
  assert.match(totals[0], /^\$\s?1,234\.56$/);
  assert.match(totals[1], /^Q\s?1,234\.56$/);
  assert.equal(totals[1], totals[2]);
});

test('agrupa los importes USD del mismo mes sin conversión de moneda', () => {
  const grouped = groupOverdueInstallments([
    { fecha_compromiso: '2026-08-31', total_a_pagar: 100.25 },
    { fecha_compromiso: '2026-08-31', total_a_pagar: 50.10 },
  ]);
  assert.equal(grouped[0].total, 150.35);
  assert.match(formatPortfolioMoney(grouped[0].total, 'USD'), /^\$\s?150\.35$/);
});
